/** Empty tbody row that keeps column headers aligned with the rest of the app tables. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tbody className="table-empty">
      <tr>
        <td colSpan={colSpan}>{children}</td>
      </tr>
    </tbody>
  )
}

export function SkuTableCell({
  code,
  styleName,
  color,
  size,
}: {
  code: string
  styleName: string
  color: string
  size: string
}) {
  return (
    <td className="card-title">
      <strong>{code}</strong>
      <small>
        {styleName} · {color} / {size}
      </small>
    </td>
  )
}
