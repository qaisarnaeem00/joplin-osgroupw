import { addColumn } from '../sqlite';
import { StringOrSqlQuery } from '../types';

export default (): StringOrSqlQuery[] => {
	return [
		addColumn('resources', 'ocr_driver_id', 'INT NOT NULL DEFAULT "1"'),
	];
};
