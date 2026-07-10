import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import api from "../api/client";
import { Card, PageHeader, Button, EmptyState } from "../components/ui";
import { formatINR, formatDate } from "../lib/format";
import useLiveCollection from "../lib/useLiveCollection";

const PERIODS = ["daily", "weekly", "monthly"];

export default function Reports() {
  const [period, setPeriod] = useState("monthly");
  const [report, setReport] = useState(null);

  const load = () => api.get(`/reports/${period}`).then((r) => setReport(r.data));
  useEffect(() => {
    load();
  }, [period]);
  useLiveCollection(["deals"], load);

  const downloadExcel = () => window.open(`/api/reports/${period}/export/excel`, "_blank");
  const downloadPdf = () => window.open(`/api/reports/${period}/export/pdf`, "_blank");

  return (
    <div>
      <PageHeader
        title="Sales Reports"
        subtitle="Daily, weekly, and monthly performance — exportable anytime"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={downloadExcel}><FileSpreadsheet size={15} /> Excel</Button>
            <Button variant="secondary" onClick={downloadPdf}><FileText size={15} /> PDF</Button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${
              period === p ? "bg-primary text-white border-primary" : "bg-white border-border text-ink/60"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {!report ? (
        <div className="text-ink/40 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="p-5">
              <p className="text-xs text-ink/50 mb-1">Deals Won ({period})</p>
              <p className="text-3xl font-display font-bold">{report.dealsWon}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-ink/50 mb-1">Total Revenue</p>
              <p className="text-3xl font-display font-bold">{formatINR(report.totalRevenue)}</p>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card className="p-5">
              <h4 className="font-display font-semibold mb-3">Product-wise Sales</h4>
              {Object.keys(report.productWise).length === 0 ? (
                <p className="text-sm text-ink/40">No sales in this period.</p>
              ) : (
                Object.entries(report.productWise).map(([product, revenue]) => (
                  <div key={product} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span>{product}</span>
                    <span className="font-mono">{formatINR(revenue)}</span>
                  </div>
                ))
              )}
            </Card>
            <Card className="p-5">
              <h4 className="font-display font-semibold mb-3">Employee Performance</h4>
              {Object.keys(report.employeePerformance).length === 0 ? (
                <p className="text-sm text-ink/40">No sales in this period.</p>
              ) : (
                Object.entries(report.employeePerformance).map(([name, revenue]) => (
                  <div key={name} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span>{name}</span>
                    <span className="font-mono">{formatINR(revenue)}</span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h4 className="font-display font-semibold mb-3">Deals in Period</h4>
            {report.deals.length === 0 ? (
              <EmptyState title="No deals won in this period" />
            ) : (
              <div className="space-y-1.5">
                {report.deals.map((d) => (
                  <div key={d.id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span>{d.title}</span>
                    <span className="flex gap-4">
                      <span className="text-ink/40 text-xs">{formatDate(d.closingDate)}</span>
                      <span className="font-mono w-24 text-right">{formatINR(d.expectedRevenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
