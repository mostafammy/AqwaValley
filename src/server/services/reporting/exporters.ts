import { canonicalJsonString, hashSha256 } from "./normalization";
import type { ExportResult, ReportData, ReportFormat } from "./types";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

export interface ExportStrategy {
  readonly format: ReportFormat;
  export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult>;
}

function sortRowsDeterministically(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) =>
    canonicalJsonString(a).localeCompare(canonicalJsonString(b)),
  );
}

type PdfDocumentLike = {
  on(event: "data", cb: (chunk: Buffer | Uint8Array) => void): PdfDocumentLike;
  on(event: "end", cb: () => void): PdfDocumentLike;
  on(event: "error", cb: (err: Error) => void): PdfDocumentLike;
  end(): void;
  fontSize(size: number): PdfDocumentLike;
  text(text: string, options?: Record<string, unknown>): PdfDocumentLike;
  moveDown(lines?: number): PdfDocumentLike;
};

async function pdfDocToBuffer(doc: PdfDocumentLike): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | Uint8Array) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export class PdfExportStrategy implements ExportStrategy {
  readonly format = "pdf" as const;

  async export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult> {
    // PDF generation is temporarily disabled due to font issues on serverless
    // For now, return an error that gets caught by the orchestrator
    throw new Error(
      "PDF generation is unavailable. Please use CSV or XLSX format instead. " +
        "PDF support requires font bundling for serverless deployment.",
    );
  }
}

export class CsvExportStrategy implements ExportStrategy {
  readonly format = "csv" as const;

  async export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult> {
    const rows = sortRowsDeterministically(input.data.rows);
    const headerSet = new Set<string>();

    for (const row of rows) {
      const sortedKeys = Object.keys(row).sort();
      for (const key of sortedKeys) headerSet.add(key);
    }

    const headers = [...headerSet].sort();
    const lines: string[] = [headers.join(",")];

    for (const row of rows) {
      const values = headers.map((key) => {
        const value = row[key];
        if (value === null || value === undefined) return "";
        const serializedSource =
          typeof value === "string"
            ? value
            : typeof value === "number" ||
                typeof value === "boolean" ||
                typeof value === "bigint"
              ? `${value}`
              : canonicalJsonString(value);
        const serialized = serializedSource.replaceAll('"', '""');
        return `"${serialized}"`;
      });
      lines.push(values.join(","));
    }

    const metadataLine = `#meta:${canonicalJsonString({
      templateVersion: input.templateVersion,
      metadata: input.metadata,
    })}`;
    const payload = Buffer.from(`${metadataLine}\n${lines.join("\n")}`, "utf8");

    return {
      format: this.format,
      fileExtension: "csv",
      contentType: "text/csv; charset=utf-8",
      outputHash: hashSha256(payload.toString("utf8")),
      payload,
    };
  }
}

export class XlsxExportStrategy implements ExportStrategy {
  readonly format = "xlsx" as const;

  async export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult> {
    const rows = sortRowsDeterministically(input.data.rows);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AqwaValley Reporting Engine";
    workbook.lastModifiedBy = "AqwaValley Reporting Engine";
    workbook.created = new Date("2026-01-01T00:00:00.000Z");
    workbook.modified = new Date("2026-01-01T00:00:00.000Z");
    workbook.properties.date1904 = false;

    const sheet = workbook.addWorksheet("Report");
    const headerSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row)
        .sort()
        .forEach((key) => headerSet.add(key));
    }
    const headers = [...headerSet].sort();

    sheet.addRow(["reportType", input.data.reportType]);
    sheet.addRow(["templateVersion", input.templateVersion]);
    sheet.addRow(["generatedAt", input.data.generatedAtIso]);
    sheet.addRow(["metadata", canonicalJsonString(input.metadata)]);
    sheet.addRow([]);
    sheet.addRow(headers);

    for (const row of rows) {
      sheet.addRow(
        headers.map((key) => {
          const value = row[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "string") return value;
          if (
            typeof value === "number" ||
            typeof value === "boolean" ||
            typeof value === "bigint"
          ) {
            return `${value}`;
          }
          return canonicalJsonString(value);
        }),
      );
    }

    const payload = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      format: this.format,
      fileExtension: "xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      outputHash: hashSha256(payload.toString("base64")),
      payload,
    };
  }
}

export class ExportEngine {
  private readonly strategies: Map<ReportFormat, ExportStrategy>;

  constructor(strategies: ExportStrategy[]) {
    this.strategies = new Map(
      strategies.map((strategy) => [strategy.format, strategy]),
    );
  }

  async exportMany(input: {
    formats: ReportFormat[];
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult[]> {
    const outputs: ExportResult[] = [];

    for (const format of input.formats) {
      const strategy = this.strategies.get(format);
      if (!strategy) {
        throw new Error(`Unsupported report format: ${format}`);
      }

      outputs.push(
        await strategy.export({
          data: input.data,
          templateVersion: input.templateVersion,
          metadata: input.metadata,
        }),
      );
    }

    return outputs;
  }
}
