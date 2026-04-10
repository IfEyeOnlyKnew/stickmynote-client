// Linear SQL statement splitter: walks the input once, tracking whether the
// cursor is inside a single-quoted string, and splits on top-level semicolons.
// This replaces a regex that had nested quantifiers vulnerable to catastrophic
// backtracking (SonarQube S5852). It recognizes standard single-quote escaping
// (doubled quotes: `''`) which is the SQL-standard escape form.
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let buffer = ""
  let inString = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    if (inString) {
      buffer += ch
      if (ch === "'") {
        // Handle escaped quote (''): skip the second one and stay in-string
        if (sql[i + 1] === "'") {
          buffer += sql[i + 1]
          i++
        } else {
          inString = false
        }
      }
      continue
    }

    if (ch === "'") {
      inString = true
      buffer += ch
      continue
    }

    if (ch === ";") {
      if (buffer.trim().length > 0) statements.push(buffer)
      buffer = ""
      continue
    }

    buffer += ch
  }

  if (buffer.trim().length > 0) statements.push(buffer)
  return statements
}
