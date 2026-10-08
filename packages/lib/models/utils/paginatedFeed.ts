import JoplinDatabase from '../../JoplinDatabase';
import { selectQuery, rawQuery, sql } from '../../services/database/queryBuilder';
import { Pagination, PaginationOrder } from './types';

export interface ModelFeedPage {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Heterogeneous: callers receive entity types (Note/Folder/Resource) which lack index signatures
	items: any[];
	has_more: boolean;
	total?: number;
}

export interface WhereQuery {
	sql: string;
	params?: (string | number | boolean)[];
}

// Note: this method might return more fields than was requested as it will
// also return fields that are necessary for pagination.
export default async function(db: JoplinDatabase, tableName: string, pagination: Pagination, whereQuery: WhereQuery = null, fields: string[] = null): Promise<ModelFeedPage> {
	fields = fields ? fields.slice() : ['id'];


	const sqlParams = whereQuery && whereQuery.params ? whereQuery.params.slice() : [];

	if (!pagination.order.length) throw new Error('Pagination order must be provided');
	if (pagination.order.length > 1) throw new Error('Only one pagination order field can be provided');

	const paginationOrder = pagination.order[0].dir;

	if (!pagination.order.find((o: PaginationOrder) => o.by === 'id')) {
		pagination = {
			...pagination,
			order: pagination.order.concat([{
				by: 'id',
				dir: paginationOrder,
				caseInsensitive: false,
			}]),
		};
	}

	let query = selectQuery(tableName, fields.length ? fields : '*');
	if (whereQuery?.sql) query = query.where(rawQuery<boolean>(whereQuery.sql, sqlParams));
	for (const order of pagination.order) {
		const field = order.caseInsensitive || pagination.caseInsensitive ? sql`${sql.ref(order.by)} COLLATE NOCASE` : sql.ref(order.by);
		query = query.orderBy(field, order.dir.toLowerCase() as 'asc' | 'desc');
	}
	query = query.limit(pagination.limit).offset((pagination.page - 1) * pagination.limit);
	const rows = await db.selectAll(query);

	return {
		items: rows,
		has_more: rows.length >= pagination.limit,
	};
}
