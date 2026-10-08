import addMigrationFile from '../addMigrationFile';
import { SqlQuery } from '../types';

// Preserve the original version 42 schema and data changes.
export default (): SqlQuery[] => [addMigrationFile(42)];
