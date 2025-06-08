import json
import logging
import os
from typing import Any

import boto3
import pyarrow as pa
from botocore.exceptions import ClientError
from pyiceberg.catalog import load_catalog
from pyiceberg.io.pyarrow import schema_to_pyarrow
from pyiceberg.table import Table

# Set up logging
LOGGER = logging.getLogger("iceberg_table_access")

# Environment variables
REGION = os.getenv("REGION")
ENV = os.getenv("ENV")
DATALAKEHOUSE_NAME = os.getenv("DATALAKEHOUSE_NAME")
DATABASE = None
TABLE_DEFINITIONS: dict[str, Any] = {}

# If the function runs locally, use the table definitions from file
TABLE_ID = os.getenv("TABLE_ID", "")
TABLE_DEFINITIONS_FILE = os.getenv("TABLE_DEFINITIONS_FILE", "")

if TABLE_DEFINITIONS_FILE and TABLE_ID:
    with open(TABLE_DEFINITIONS_FILE) as f:
        TABLE_DEFINITIONS = json.load(f)[TABLE_ID]
else:
    TABLE_DEFINITIONS = json.loads(os.getenv("TABLE_DEFINITIONS", ""))

SESSION = boto3.Session(region_name=REGION)
SSM_CLIENT = SESSION.client("ssm")

def _get_ssm_parameter(param_name: str) -> Any:
    if not param_name.startswith("/"):
        return param_name
    param_name = param_name.replace("{env}", ENV)
    try:
        response = SSM_CLIENT.get_parameter(Name=param_name, WithDecryption=True)
        return response["Parameter"]["Value"]
    except ClientError as err:
        error_code = err.response["Error"]["Code"]
        if error_code == "ParameterNotFound":
            LOGGER.error(f"SSM parameter '{param_name}' not found.")
        elif error_code == "InvalidKeyId":
            LOGGER.error(f"SSM parameter '{param_name}' has invalid KMS key. {err}")
        else:
            LOGGER.error(f"Unexpected error retrieving SSM parameter '{param_name}': {err}")
        return None

def _resolve_ssm_params_in_dict(d: dict[str, Any]) -> dict[str, Any]:
    LOGGER.debug(f"Resolving SSM parameters in dictionary: {d}")
    for key, value in d.items():
        if isinstance(value, str) and value.startswith("/"):
            d[key] = _get_ssm_parameter(value)
        elif isinstance(value, dict):
            _resolve_ssm_params_in_dict(value)
        elif isinstance(value, list):
            d[key] = [_get_ssm_parameter(item) if isinstance(item, str) and item.startswith("/") else item for item in value]
    return d

def _init_connection(table_definition: dict[str, Any]) -> Table:
    try:
        table_name = table_definition["TABLE_NAME"]
        full_table_name = f"{DATABASE}.{table_name}"

        # Assumes default catalog config is present in environment or pyiceberg config
        catalog = load_catalog("default", **{"type": "glue"})
        table = catalog.load_table(full_table_name)

        return table
    except Exception as e:
        LOGGER.error(f"Failed to initialize connection to Iceberg table: {e}")
        raise

def _process_batch(table: Table, batch: list[dict[Any, Any]]) -> bool:
    if not table or not batch:
        LOGGER.error("Empty batch.")
        return False

    try:
        # Convert dict batch to PyArrow Table
        schema = schema_to_pyarrow(table.schema())
        batch_table = pa.Table.from_pylist(batch, schema=schema)

        # Write the records to the table
        table.upsert(batch_table)
        return True
    except Exception as e:
        LOGGER.error(f"Failed to write batch to Iceberg table: {e}")
        return False

def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:

    global DATABASE

    LOGGER.debug(f"Received {len(event['Records'])} record(s) from stream.")

    if len(event['Records']) == 0:
        LOGGER.warning("No records to process.")
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "No records to process."})
        }

    results = {}

    DATABASE = _get_ssm_parameter(DATALAKEHOUSE_NAME)

    # The table definitions might have unresolved SSM parameters as values
    resolved_table_definitions = _resolve_ssm_params_in_dict(TABLE_DEFINITIONS)

    # This loop runs once if the Lambda is deployed, otherwise it runs for each table
    for table_id, table_name in resolved_table_definitions.items():
        LOGGER.debug(f"Resolved table definition for {table_id}: {table_name}")
        table = _init_connection(table_name)

        # Sort the records by SentTimestamp (as int, timezone is UTC)
        sorted_records = sorted(event["Records"], key=lambda r: int(r["attributes"]["SentTimestamp"]))

        # Create a batch from sorted records
        batch = [json.loads(record["body"]) for record in sorted_records]

        result = _process_batch(table, batch)

        if result:
            status_code = 200
            result_str = f"Successfully processed batch of {len(batch)} record(s)."
            results[table_id] = result_str
        else:
            status_code = 500
            result_str = f"Failed to process batch of {len(batch)} record(s)."
            results[table_id] = result_str

        LOGGER.debug(results[table_id])

    return {
        "statusCode": status_code,
        "body": json.dumps(results)
    }
