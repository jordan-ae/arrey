import Ajv from "ajv";
import {
  ArreySchema,
  JsonSchema,
  SchemaField,
  ValidationError,
  ValidationResult
} from "./types";

const ajv = new Ajv({ allErrors: true, strict: false });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFieldOptionality(field: SchemaField): {
  optional: boolean;
  normalized: Exclude<SchemaField, `${string}?`> | "string" | "number" | "boolean";
} {
  if (typeof field === "string" && field.endsWith("?")) {
    return {
      optional: true,
      normalized: field.slice(0, -1) as "string" | "number" | "boolean"
    };
  }
  return {
    optional: false,
    normalized: field as Exclude<SchemaField, `${string}?`>
  };
}

function fieldToJsonSchema(field: SchemaField): JsonSchema {
  const { normalized } = normalizeFieldOptionality(field);

  if (typeof normalized === "string") {
    if (normalized === "string") {
      return { type: "string" };
    }
    if (normalized === "number") {
      return { type: "number" };
    }
    if (normalized === "boolean") {
      return { type: "boolean" };
    }
    if (normalized === "string[]") {
      return { type: "array", items: { type: "string" } };
    }
    if (normalized === "number[]") {
      return { type: "array", items: { type: "number" } };
    }
  }

  if (isPlainObject(normalized)) {
    if (normalized.type === "string") {
      const schema: JsonSchema = { type: "string" };
      if (Array.isArray(normalized.enum) && normalized.enum.length > 0) {
        schema.enum = normalized.enum;
      }
      if (typeof normalized.pattern === "string") {
        schema.pattern = normalized.pattern;
      }
      return schema;
    }

    if (normalized.type === "number") {
      const schema: JsonSchema = { type: "number" };
      if (typeof normalized.min === "number") {
        schema.minimum = normalized.min;
      }
      if (typeof normalized.max === "number") {
        schema.maximum = normalized.max;
      }
      return schema;
    }

    if (normalized.type === "object") {
      return arreySchemaToJsonSchema(normalized.fields);
    }

    if (normalized.type === "array") {
      return {
        type: "array",
        items: fieldToJsonSchema(normalized.items)
      };
    }
  }

  return {};
}

export function arreySchemaToJsonSchema(schema: ArreySchema): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [rawKey, field] of Object.entries(schema)) {
    const keyOptional = rawKey.endsWith("?");
    const key = keyOptional ? rawKey.slice(0, -1) : rawKey;
    const { optional: valueOptional } = normalizeFieldOptionality(field);

    properties[key] = fieldToJsonSchema(field);
    if (!keyOptional && !valueOptional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function toValidationErrors(input: unknown, errors: unknown[] | null | undefined): ValidationError[] {
  if (!errors || errors.length === 0) {
    return [
      {
        field: "/",
        message: "Validation failed.",
        received: input
      }
    ];
  }

  return errors.map((error) => {
    const candidate = error as {
      instancePath?: string;
      message?: string;
      params?: Record<string, unknown>;
    };
    return {
      field: candidate.instancePath && candidate.instancePath.length > 0 ? candidate.instancePath : "/",
      message: candidate.message ?? "Invalid value.",
      received: candidate.params
    };
  });
}

export function validateWithArreySchema<T>(
  value: unknown,
  schema: ArreySchema
): ValidationResult<T> {
  const compiled = ajv.compile(arreySchemaToJsonSchema(schema));
  const success = compiled(value);

  if (success) {
    return {
      success: true,
      data: value as T
    };
  }

  return {
    success: false,
    errors: toValidationErrors(value, compiled.errors)
  };
}
