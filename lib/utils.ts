import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';

/**
 * This function adds the necessary permissions to a Lambda function's role policy
 * to allow it to access Iceberg tables in AWS Glue (and Athena) and SSM parameters in Parameter Store.
 * Additonally, the `s3Resources` parameter can be used to add extra S3 resources to the policy,
 * useful for testing with a separate table.
 *
 * The permissions are scoped to the resources created specifically for the `datalakehouse` database
 * and the S3 buckets used for the Iceberg tables.
 *
 * @param {DockerImageFunction} lambdaFunction The Lambda function to add the policy to.
 * @param {any} config A configuration object containing the account, region and environment.
 */
export function addIcebergAccessToRolePolicy(lambdaFunction: DockerImageFunction, config: any) {
    // Allow reading from Parameter Store (scoped)
    lambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
            `arn:aws:ssm:${config.region}:${config.account}:parameter/service/data/${config.environment}/published/iceberg/*`
        ]
    }));

    // Grant Glue permissions
    lambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: [
            "glue:BatchCreatePartition",
            "glue:CreateTable",
            "glue:UpdateTable",
            "glue:GetTable",
            "glue:GetTables",
            "glue:GetDatabase",
            "glue:GetDatabases",
            "glue:GetPartition",
            "glue:GetPartitions",

        ],
        resources: [
            `arn:aws:glue:${config.region}:${config.account}:catalog`,
            `arn:aws:glue:${config.region}:${config.account}:database/datalakehouse`,
            `arn:aws:glue:${config.region}:${config.account}:table/*/*`
        ]
    }));

    // Grant Glue permissions to delete temporary tables (used in CTAS approach)
    lambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: [
            "glue:DeleteTable"
        ],
        resources: [
            `arn:aws:glue:${config.region}:${config.account}:catalog`,
            `arn:aws:glue:${config.region}:${config.account}:database/datalakehouse`,
            `arn:aws:glue:${config.region}:${config.account}:table/datalakehouse/temp_*`,
        ]
    }));

    // Grant Athena permissions
    lambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: [
            "athena:StartQueryExecution",
            "athena:GetQueryExecution",
            "athena:GetQueryResults",
            "athena:GetWorkGroup",
            "athena:GetDatabase",
            "athena:GetTableMetadata"
        ],
        resources: [`arn:aws:athena:${config.region}:${config.account}:workgroup/primary`]
    }));

    // Grant S3 permissions
    lambdaFunction.addToRolePolicy(new PolicyStatement({
        actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:ListBucket",
            "s3:GetBucketLocation"
        ],
        resources: [
            // Workgroup default output location
            `arn:aws:s3:::aws-athena-query-results-${config.account}-${config.region}`,
            `arn:aws:s3:::aws-athena-query-results-${config.account}-${config.region}/*`,
            // Additional S3 resources for Iceberg tables
            ...(config.s3Resources ?? [])
        ]
    }));
}