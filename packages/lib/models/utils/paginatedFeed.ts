import JoplinDatabase from '../../JoplinDatabase';
import { queryBuilder as qb, legacyCondition, sql } from '../../services/database/kysely';
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

	const query = qb.selectFrom(tableName);
	let select = fields.length ? query.select(fields) : query.selectAll();
	if (whereQuery?.sql) select = select.where(legacyCondition(whereQuery.sql, whereQuery.params || []));
	for (const order of pagination.order) {
		const field = order.caseInsensitive || pagination.caseInsensitive
			? sql`${sql.ref(order.by)} COLLATE NOCASE` : sql.ref(order.by);
		select = select.orderBy(field, order.dir.toLowerCase() as 'asc' | 'desc');
	}
	const rows = await db.selectAll(select.limit(pagination.limit).offset((pagination.page - 1) * pagination.limit));

	return {
		items: rows,
		has_more: rows.length >= pagination.limit,
	};
}
