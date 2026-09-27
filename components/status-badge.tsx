import type { CastStatus, OrderStatus } from "@/lib/types";
const labels: Record<CastStatus | OrderStatus, string> = {
  waiting: "待機中", moving: "移動中", serving: "接客中", off: "退勤",
  accepted: "受付済", dispatching: "配車中", completed: "完了", cancelled: "キャンセル",
};
export function StatusBadge({ status }: { status: CastStatus | OrderStatus }) {
  return <span className={`badge badge-${status}`}>{labels[status]}</span>;
}
