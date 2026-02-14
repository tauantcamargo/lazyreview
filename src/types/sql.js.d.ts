declare module 'sql.js' {
  export interface SqlJsStatic {
    readonly Database: new (data?: ArrayLike<number>) => Database
  }

  export interface QueryExecResult {
    readonly columns: readonly string[]
    readonly values: ReadonlyArray<ReadonlyArray<SqlValue>>
  }

  export type SqlValue = string | number | Uint8Array | null

  export interface BindParams {
    readonly [key: string]: SqlValue
  }

  export interface Statement {
    bind(params?: BindParams | ReadonlyArray<SqlValue>): boolean
    step(): boolean
    getAsObject(params?: BindParams): Record<string, SqlValue>
    free(): boolean
    reset(): void
  }

  export interface Database {
    run(sql: string, params?: BindParams | ReadonlyArray<SqlValue>): Database
    exec(sql: string, params?: BindParams | ReadonlyArray<SqlValue>): readonly QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  export interface InitSqlJsOptions {
    readonly locateFile?: (filename: string) => string
  }

  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>
}
