import { Duration, StackProps } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { IEventSource, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IQueue } from 'aws-cdk-lib/aws-sqs';

export interface EnvAwareStackProps extends StackProps {
  environment: string;
}

/**
 * Defines the structure of a table definition in the JSON file, required to
 * pass the information to the Lambda function.
 */
export interface TableDefinition {
    TABLE_NAME: string[];
}

/**
 * Properties that define a table created by an SQL query in AWS Athena.
 */
export interface TableBuildProps {
    /**
     * Name of the Iceberg table in the DataLakehouse.
     * Iceberg tables are always created using the table name as prefix in S3.
     * @example
     * icebergTableName = "example_table";
     * tableBucket = "iceberg_tables"
     * // resulting S3 path for table data
     * uri = "s3://iceberg_tables/example_table/data/"
     */
    icebergTableName: string,
    /**
     * The columns of the table as a string as pairs of column name and data type.
     * The value is a string as it would be written in a SQL query.
     * IMPORTANT: Data types have to be Iceberg compatible, see https://iceberg.apache.org/spec/#schemas-and-data-types.
     * If not provided, the schema is inferred from the schema file.
     * @example
     * columns='\
     * id string,\
     * date date,\
     * refs list<string>,\
     * options map<string, string>,\
     * other struct<col1: int, col2: float, col3: timestamp>
     */
    columns?: string,
    /**
     * Any columns (with data type) that are not included in the schema.
     * @example
     * extraColumns = ["ts timestamp", "sum float"]
     */
    extraColumns?: Array<string>,
    /**
     * Name of the database in AWS Glue.
     */
    databaseName: string,
    /**
     * The AWS Glue catalog's name.
     */
    catalogName: string,
    /**
     * Name of the JSON file with the schema of the table.
     * This is relative to `data/schemas/` directory.
     */
    schemaFileName: string,
    /**
     * An optional dictionary to be used as a mapping.
     * It has to be in the form:
     * ```
     * {
     *   "existing_col_name": {
     *     "new_col_name": {"type": "new_type"}
     *   }
     * }
     * ```
     */
    mapping?: any,
    /**
     * Name of the S3 bucket where the table is stored.
     */
    bucketName: string,
    /**
     * An optional prefix to be used in the S3 path, must end with '/'.
     * Resolves to 's3://${bucketName}/${bucketPrefix}${tableName}/'.
     */
    bucketPrefix?: string,
    /**
     * The name of the bucket where the Athena query data should be stored.
     * If not specified, the default location is used.
     */
    outputBucketName?: string,
    /**
     * An optional prefix to be used in the S3 path for the output bucket.
     * Can be used without the `outputBucketName` parameter. In this case
     * `bucketName` and `bucketPrefix` are used for the location.
     * Resolves to 's3://${outputBucketName}/${outputBucketPrefix}/${tableName}'.
     */
    outputBucketPrefix?: string,
    /**
     * The name of the bucket where the schema file is saved, using the table name as prefix.
     * If not specified, `bucketName` and `bucketPrefix` are used for the location.
     */
    schemaBucketName: string,
    /**
     * An optional prefix to be used in the S3 path for the output bucket.
     * Can be used without the `schemaBucketName` parameter. In this case
     * `bucketName` and `bucketPrefix` are used for the location.
     * Resolves to 's3://${schemaBucketName}/${schemaBucketPrefix}/${tableName}'.
     */
    schemaBucketPrefix?: string,
    /**
     * An optional instruction on how to partition the table.
     * See: https://iceberg.apache.org/spec/#schemas-and-data-types.
     * @example
     * partitionedBy = ['id', 'hour(date_col)']
     */
    partitionedBy?: Array<string>,
    /**
     * An optional SQL query that is used when the resource is **created**.
     * WARNING: This overwrites the default behaviour, that is creating the table.
     * Use this only to change **how** the table is created.
     */
    onCreateQuery?: string,
    /**
     * An optional SQL query that is used when the resource is **updated**.
     * This can be used to update the table.
     */
    onUpdateQuery?: string,
    /**
     * An optional SQL query that is used when the resource is **deleted**.
     * WARNING: This overwrites the default behaviour, that is deleting the table.
     * This can be set to `undefined` to not do anything when the resource is deleted.
     */
    onDeleteQuery?: string
}

/**
 * Properties to define AWS SDK calls to be used in
 * AwsCustomResource objects.
 */
export interface SdkCallProps {
    /**
     * Name of the table.
     */
    tableName: string,
    /**
     * The query to be used for the SDK call.
     */
    query: string,
    /**
     * Name of the database as the context for the query.
     */
    databaseName: string,
    /**
     * The S3 location where the query output is stored.
     */
    outputLocation: string
}

/**
 * Properties to define a Lambda function.
 */
export interface LambdaFunctionProps {
    /**
     * The name for the Lambda function. If not provided, a random name is assigned by AWS.
     */
    functionName?: string,
    /**
     * The name of the directory containing the Lambda function code, relative to "src/lambdas/".
     */
    lambdaDir: string,
    /**
     * The name of the handler file and function in the format `{function_name}.{handler_name}`.
     *
     * The file name containing the handler must be relative to "src/lambdas/".
     * Assuming the file name is "some_lambda.py" and the handler function name is "some_handler",
     * the value would be "some_lambda.some_handler".
     */
    lambdaHandler: string,
    /**
     * An optional list of Lambda layers to use with this function.
     */
    layers?: Array<LayerVersion>,
    /**
     * An optional list of event sources that triggers the function.
     * This can be SNS, SQS, Kinesis or a DynamoDB table stream.
     */
    eventSources?: Array<IEventSource>,
    /**
     * An optional Dead Letter Queue to write failed events to.
     */
    dlq?: IQueue,
    /**
     * An optional dictionary with environmental variables to be used in the Lambda function.
     */
    environmentVariables: any,
    /**
     * The Python version to use for this function.
     */
    pythonVersion?: string,
    /**
     * The runtime to use for this function. Default is PYTHON_3_10.
     */
    runtime?: Runtime,
    /**
     * The role to use for the Lambda function. If not provided, a role is created by AWS.
     */
    role?: Role,
    /**
     * The maximum number of concurrent executions that the function can process.
     */
    reservedConcurrentExecutions?: number
}

/**
 * Properties to define a Lambda function based on a prebuilt Docker image.
 */
export interface DockerImageLambdaFunctionProps {
    /**
     * The name of the Lambda function. If not provided, a random name is assigned by AWS.
     */
    functionName: string,
    /**
     * An optional description for the Lambda function.
     */
    description?: string,
    /**
     * An optional list of event sources that triggers the function.
     * This can be SNS, SQS, Kinesis or a DynamoDB table stream.
     */
    eventSources?: Array<IEventSource>,
    /**
     * An optional dictionary with environmental variables to be used in the Lambda function.
     */
    environmentVariables: any,
    /**
     * The Python version to use for this function.
     */
    pythonVersion: string,
    /**
     * Additional paths to add to PYTHONPATH environment variable.
     */
    pythonPath?: Array<string>,
    /**
     * The number of concurrent executions that the function can process.
     */
    reservedConcurrentExecutions?: number,
    /**
     * The name of the ECR repository that contains the Docker image.
     */
    repositoryName: string,
    /**
     * The tag or digest of the Docker image to use.
     */
    tagOrDigest: string,
    /**
     * A flag to indicate whether or not the Lambda function should be versioned.
     * Setting this to `true` will add a `VERSION` environment variable to the Lambda function.
     * It's value is a ISO formatted string of the current date and time, forcing a deployment of the function
     * independent of the code changes. Use this to mitigate issues where code changes are not recognized by AWS.
     */
    setVersion?: boolean,
    /**
     * The memory size of the Lambda function. If not provided, the default is 128 MB.
     * The maximum value is 10,240 MB.
     */
    memorySize?: number,
    /**
     * The retention period for the Lambda function's logs. If not provided, the default is infinite retention.
     */
    logRetention?: RetentionDays,
    /**
     * The timeout for the Lambda function. If not provided, the default is 3 seconds.
     * The maximum value is 15 minutes.
     */
    timeout?: Duration,
    /**
     * An optional Dead Letter Queue to write failed events to.
     */
    dlq?: IQueue,
    /**
     * The role to use for the Lambda function. If not provided, a role is created by AWS.
     */
    role?: Role,
}

/**
 * Properties to define a Lambda SQS queue.
 */
export interface SqsQueueProps {
    /**
     * If set to `true`, creates a First-In-First-Out queue.
     */
    isFifo?: boolean,
    /**
     * The time SQS retains the message. If not set, the default is 4 days.
     */
    retentionPeriod?: Duration,
    /**
     * The time that the processor has to process the message. After this time, the message
     * becomes fisible again and can be processed by another processor.
     * If not set, the default is 30 seconds.
     */
    visibilityTimeout?: Duration,
    /**
     * If set to `true`, creates only a dead letter queue.
     */
    isDlq?: boolean
}
