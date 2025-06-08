import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';

/**
 * Extended cdk.Stack class that automatically handles versioning.
 * When synthesized, an output is created based on an additional field "stackVersions"
 * in the package.json file, with nested fields for every stack created.
 *
 * Only major stacks are considered, meaning if a (nested) stack has the ID
 * "DataLakehouse-{env}-SomeStackId-Nested-MoreNested", then the first parts
 * "DataLakehouse-{env}-SomeStackId" are used as a stack identifier.
 *
 * To use versioning, simply extend your class.
 * @example
 * import { VersionedStack } from './versionedStack';
 * export class SomeNewStack extends VersionedStack {...}
 */
export class VersionedStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Assuming the id is always in the form "DataLakehouse-{env}-SomeStackId-NestedStack"
        const parts = id.split("-");

        // Use "SomeStackId" from "DataLakehouse-{env}-SomeStackId-NestedStack" as the stack identifier
        const stackId = parts[2];

        // Get version
        const version = this.getVersion(stackId);

        // Output the version
        new CfnOutput(this, `${stackId}-StackVersion`, {
        value: version,
        description: `The version of the stack ${stackId}.`,
        });
    }

    /**
     * Reads and returns the current version for this stack from the `package.json` file's
     * `stackVersions` field. If the file doesn't contain an entry for the current stack,
     * it is created and set to an initial value of "0.0.1".
     *
     * To update the version, the stack's versions must be modified manually.
     * If the version is not in the correct format, an error is raised.
     *
     * @param stackId The ID of the current stack.
     * @returns A semantic versioning string in the format "{major}.{minor}.{patch}".
     * @throws Error if the version string in the file is in the wrong format, e.g. "{major}.{minor}.{patch}".
     */
    private getVersion(stackId: string): string {
        // The versions are stored in the package.json file
        const filePath = "./package.json";

        // Read and parse the package.json file
        const packageJson = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Ensure the stackVersions field exists
        if (!packageJson.stackVersions) {
            packageJson.stackVersions = {};
        }

        // Get the current version for the stack or set it to an initial version
        let currentVersion = packageJson.stackVersions[stackId] || "0.0.1";

        // Validate the version format
        const versionRegex = /^\d+\.\d+\.\d+$/;
        if (!versionRegex.test(currentVersion)) {
            throw new Error(`Invalid version format for stack ${stackId}: ${currentVersion}.`);
        }

        // Write the updated package.json back to the file
        packageJson.stackVersions[stackId] = currentVersion;
        fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2));

        return currentVersion;
    }
}
