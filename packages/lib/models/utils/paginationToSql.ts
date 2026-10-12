import type { SelectQueryBuilder } from 'kysely';
import { collateNoCase, DynamicDatabase } from '../../services/database/kysely';
import { Pagination } from './types';

export default function(pagination: Pagination): string {
	const sql: string[] = [];

	for (let i = 0; i < pagination.order.length; i++) {
		const o = pagination.order[i];
		let item = `\`${o.by}\``;
		if (!!o.caseInsensitive || !!pagination.caseInsensitive) item += ' COLLATE NOCASE';
		item += ` ${o.dir}`;
		sql.push(item);
	}

	return sql.join(', ');
}

// Query builder counterpart of the retained public SQL formatting API.
export function applyQueryOrder<O>(query: SelectQueryBuilder<DynamicDatabase, string, O>, order: { by: string; dir: string; caseInsensitive?: boolean }[], caseInsensitive = false) {
	for (const item of order) {
		const column = item.caseInsensitive || caseInsensitive ? collateNoCase(item.by) : item.by;
		query = query.orderBy(column, item.dir.toLowerCase() as 'asc' | 'desc');
	}
	return query;
}
