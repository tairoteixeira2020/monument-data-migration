import { ValueTransformer } from 'typeorm';

export const isoDateTransformer: ValueTransformer = {
  // called when writing to the DB
  to(value: string | null): Date | null {
    return value != null ? new Date(value) : null;
  },
  // called when reading from the DB
  from(value: Date | null): string | null {
    return value != null ? value.toISOString() : null;
  },
};
