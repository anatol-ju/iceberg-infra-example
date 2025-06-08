#!/usr/bin/env node
import 'source-map-support/register';

import { Duration } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { DeduplicationScope, Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { EnvAwareStackProps, SqsQueueProps } from './interfaces';

//////////////////////////////////////////////////
// SQS
//////////////////////////////////////////////////

/**
 * Create an SQS queue and DLQ.
 */
export class SqsQueue extends Construct {
    private _queue: Queue;
    private _dlq: Queue;
    private _kmsKey: Key;
    private env: string;
    private stackPrefix: string;

    constructor(scope: Construct, id: string, props: EnvAwareStackProps) {
        super(scope, id);

        const { env, environment } = props;
        const { account, region } = env || {};
        this.env = environment;
        this.stackPrefix = id;

        if (!(account && region)) {
            throw Error('Account and/or region not set - these need to be set to build stack.')
        }
    }

    public get queue() {
        return this._queue
    }

    public get dlq() {
        return this._dlq
    }

    public get kmsKey() {
        return this._kmsKey
    }

    /**
     * Create an SQS queue using a custom KMS key and a dead letter queue (DLQ).
     */
    public build(props: SqsQueueProps) {
        // Use custom key
        const customKey = new Key(this, `${this.stackPrefix}-KmsKey`, {
            description: "A custom KMS key for the SQS queue that contains data to write to DataLakehouse tables."
        });
        this._kmsKey = customKey;

        let dlq: Queue | undefined;
        let queue: Queue | undefined;

        let baseQueueProps: QueueProps = {
            encryption: QueueEncryption.KMS,
            encryptionMasterKey: customKey,
            enforceSSL: true, // Encryption in transit
            retentionPeriod: props.retentionPeriod ?? Duration.days(4)
        };

        if (props.isFifo) {
            baseQueueProps = {
                ...baseQueueProps,
                fifo: props.isFifo,
                contentBasedDeduplication: true,
                deduplicationScope: DeduplicationScope.MESSAGE_GROUP
            };
        }

        const dlqProps: QueueProps = {
            ...baseQueueProps,
            queueName: props.isFifo ? `${this.stackPrefix}-DLQ.fifo` : `${this.stackPrefix}-DLQ`,
        };

        const queueProps: QueueProps = {
            ...baseQueueProps,
            queueName: props.isFifo ? `${this.stackPrefix}-Queue.fifo` : `${this.stackPrefix}-Queue`,
            visibilityTimeout: props.visibilityTimeout ?? Duration.seconds(30)
        };

        dlq = new Queue(this, `${this.stackPrefix}-DLQ`, dlqProps);
        if (!props.isDlq) {
            queue = new Queue(this, `${this.stackPrefix}-Queue`, {
                ...queueProps,
                deadLetterQueue: {
                    queue: dlq,
                    maxReceiveCount: 5
                }
            });
        }

        // Use the last part of the stack prefix as ID
        const parts = this.stackPrefix.split("-");
        const prefix = `${parts[parts.length-2]}-${parts[parts.length-1]}`.replace(`${this.env}-`, "").toLowerCase();

        if (queue) {
            const queueArnSsmParameter = `/service/data/${this.env}/published/sqs/${prefix}-queue-arn`;

            new StringParameter(this, `${this.stackPrefix}-QueueArnSsmParameter`, {
                parameterName: queueArnSsmParameter,
                stringValue: queue.queueArn
            });

            const queueUrlSsmParameter = `/service/data/${this.env}/published/sqs/${prefix}-queue-url`;

            new StringParameter(this, `${this.stackPrefix}-QueueUrlSsmParameter`, {
                parameterName: queueUrlSsmParameter,
                stringValue: queue.queueUrl
            });

            this._queue = queue;
        }

        const dlqArnSsmParameter = `/service/data/${this.env}/published/sqs/${prefix}-dlq-arn`;

        new StringParameter(this, `${this.stackPrefix}-DlqArnSsmParameter`, {
            parameterName: dlqArnSsmParameter,
            stringValue: dlq.queueArn
        });

        const dlqUrlSsmParameter = `/service/data/${this.env}/published/sqs/${prefix}-dlq-url`;

        new StringParameter(this, `${this.stackPrefix}-DlqUrlSsmParameter`, {
            parameterName: dlqUrlSsmParameter,
            stringValue: dlq.queueUrl
        });

        this._dlq = dlq;
    }
}
