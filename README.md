# Iceberg Infra Example with AWS CDK

This is a project that demonstrates a scalable AWS infrastructure setup using the AWS CDK (Cloud Development Kit) in TypeScript. It focuses on building a serverless ingestion pipeline for Apache Iceberg tables with support for modular environments and secure, event-driven architecture.

> 🛠️ This repository was created for demonstration purposes and is part of my engineering portfolio. While it can be adapted for real use cases, it is not actively maintained for production.

---

## 🚀 What It Does

This project sets up:

- **SQS queues with KMS encryption** and dead letter queues (DLQs)
- **Dockerised Lambda functions** for processing SQS messages
- **Apache Iceberg table access** via PyIceberg, with secure SSM parameter resolution
- **CDK stack separation** per environment (e.g. dev, staging, prod)
- **ECR-based Docker image versioning and checksum tagging**
- **Athena and Glue integration** for Iceberg metadata

---

## 📁 Project Structure

```bash
iceberg-infra-example/
│
├── lib/                                # CDK constructs and stack logic
│   ├── lambdaFunctionConstruct.ts
│   ├── lambdaFunctionStack.ts
│   ├── sqsConstruct.ts
│   ├── sqsStack.ts
│   ├── utils.ts
│   └── interfaces.ts
│
├── src/lambdas/iceberg_table_access/
│   └── iceberg_table_access.py         # Lambda handler for writing to Iceberg
│
├── scripts/
│   └── build_images.sh                 # Builds and pushes Docker images with versioning
│
├── bin/
│   ├── index.ts                        # Entrypoint for CDK app
│   └── createIcebergTableAccess.ts     # Pipeline orchestration
│
├── docker-compose.yaml                 # Defines local lambda build environments
└── lambda.Dockerfile                   # Image to define Lambda
```

---

## 🧰 Tech Stack

- **AWS CDK (TypeScript)**
- **Apache Iceberg + Glue Catalog**
- **AWS Lambda (Python via Docker image)**
- **Amazon SQS + KMS**
- **ECR for image deployment**
- **SSM Parameter Store for configuration**
- **Athena for querying Iceberg tables**
- **PyIceberg for table interaction**

---

## ⚙️ Key Features

- **Modular CDK design** for reusability and separation of concerns
- **Environment-agnostic configuration** with custom stack props
- **Secure configuration loading** via SSM and KMS
- **Efficient image management** using checksum-tagged Docker builds
- **Batch processing** of SQS records sorted by timestamp

---

## 📦 Getting Started

1. **Build Docker Images for Lambda**
   ```bash
   ./scripts/build_images.sh dev
   ```
2.	**Deploy CDK Stacks**
    ```bash
    yarn deploy:dev
    ```
3.	**Trigger with SQS**
    - Send JSON payloads to the generated SQS URL.
    - Lambda will upsert them to the defined Iceberg tables.

---

## 📝 Notes
- This project assumes a pre-configured Glue catalog, ECR repository, and S3 output location.
- SSM parameter paths are auto-generated and environment-aware.
- Docker image tagging is deterministic based on handler and dependency checksums.

---

## 📚 Table Definitions

Each table is defined in table_definitions.json and supports runtime configuration:
```json
{
  "example": "/service/data/{env}/published/iceberg/example_table-name"
}
```

## 🧑‍💻 Author

Anatol Jurenkow

Cloud Data Engineer | AWS Enthusiast | Iceberg Fan

(https://github.com/anatol-ju)[GitHub] · (https://de.linkedin.com/in/anatol-jurenkow)[LinkedIn]

---

## 📄 License

“This project is for portfolio purposes only. Please contact me if you’d like to reuse or adapt this code.”
