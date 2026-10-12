import addMigrationFile from '../addMigrationFile';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addMigrationFile(42),
	];
};
