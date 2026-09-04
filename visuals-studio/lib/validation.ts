import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import schema from "./job-schema.json";
import type { VisualJobV1 } from "./contracts";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export function validateVisualJob(input: unknown): VisualJobV1 {
  if (!validate(input)) {
    throw new Error(formatValidationErrors(validate.errors));
  }
  return input as VisualJobV1;
}

export function formatValidationErrors(errors: ErrorObject[] | null | undefined) {
  if (!errors?.length) return "The visual job is invalid.";
  return errors
    .map((error) => `${error.instancePath || "job"} ${error.message || "is invalid"}`)
    .join("; ");
}
