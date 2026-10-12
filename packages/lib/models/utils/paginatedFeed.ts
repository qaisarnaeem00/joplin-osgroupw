import JoplinDatabase from '../../JoplinDatabase';
import { applyQueryOrder } from './paginationToSql';
import { db as queryBuilder, compile, legacyCondition, DynamicDatabase } from '../../services/database/kysely';
import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import { Pagination, PaginationOrder } from './types';

export interface ModelFeedPage {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Heterogeneous: callers receive entity types (Note/Folder/Resource) which lack index signatures
	items: any[];
	has_more: boolean;
	total?: number;
}

export interface WhereQuery {
	// SQL is retained for external compatibility; internal consumers use expression.
	sql?: string;
	expression?: (eb: ExpressionBuilder<DynamicDatabase, string>)=> Expression<SqlBool>;
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

	const selection = queryBuilder.selectFrom(tableName);
	let query = fields.length ? selection.select(fields) : selection.selectAll();
	if (whereQuery?.expression) query = query.where(whereQuery.expression);
	if (whereQuery?.sql) query = query.where(legacyCondition(whereQuery.sql, whereQuery.params || []));
	query = applyQueryOrder(query, pagination.order, pagination.caseInsensitive)
		.limit(pagination.limit).offset((pagination.page - 1) * pagination.limit);
	const rows = await db.selectAll(compile(query));

	return {
		items: rows,
		has_more: rows.length >= pagination.limit,
	};
}
