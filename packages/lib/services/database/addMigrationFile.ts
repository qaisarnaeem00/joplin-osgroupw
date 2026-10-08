import { compileQuery, queryBuilder, sql } from './queryBuilder';
export default (num: number) => {
	const timestamp = Date.now();
	return compileQuery(
		queryBuilder
			.insertInto('migrations')
			.values([
				{ number: sql.val(num), created_time: sql.val(timestamp), updated_time: sql.val(timestamp) },
			]),
	);
};
