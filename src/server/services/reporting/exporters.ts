import { canonicalJsonString, hashSha256 } from "./normalization";
import type { ExportResult, ReportData, ReportFormat } from "./types";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

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

function serializeCellValue(value: unknown): string {
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
}

export class PdfExportStrategy implements ExportStrategy {
  readonly format = "pdf" as const;

  async export(input: {
    data: ReportData;
    templateVersion: string;
    metadata: Record<string, unknown>;
  }): Promise<ExportResult> {
    const rows = sortRowsDeterministically(input.data.rows);
    const headerSet = new Set<string>();

    for (const row of rows) {
      Object.keys(row)
        .sort()
        .forEach((key) => headerSet.add(key));
    }

    const headers = [...headerSet].sort();
    const chunks: Buffer[] = [];

    const payload = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        compress: false,
        info: {
          Title: `AqwaValley ${input.data.reportType} Report`,
          Author: "AqwaValley Reporting Engine",
          Subject: "Deterministic report export",
          Keywords: "aqwavalley,reporting,pdf",
          Creator: "AqwaValley Reporting Engine",
          Producer: "AqwaValley Reporting Engine",
          CreationDate: new Date("2026-01-01T00:00:00.000Z"),
          ModDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      });

      doc.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (error) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });

      doc.font("Helvetica").fontSize(16).text("AqwaValley Report", {
        align: "left",
      });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Report Type: ${input.data.reportType}`);
      doc.fontSize(10).text(`Template Version: ${input.templateVersion}`);
      doc.fontSize(10).text(`Generated At: ${input.data.generatedAtIso}`);
      doc
        .fontSize(10)
        .text(`Metadata: ${canonicalJsonString(input.metadata)}`, {
          width: 500,
        });

      if (headers.length === 0) {
        doc.moveDown(1);
        doc.fontSize(10).text("No data rows available.");
      } else {
        doc.moveDown(1);
        doc.fontSize(11).text(`Columns: ${headers.join(", ")}`, {
          width: 500,
        });
        doc.moveDown(0.5);

        for (const row of rows) {
          const line = headers
            .map((key) => `${key}=${serializeCellValue(row[key])}`)
            .join(" | ");
          doc.fontSize(9).text(line, {
            width: 500,
          });
        }
      }

      doc.end();
    });

    return {
      format: this.format,
      fileExtension: "pdf",
      contentType: "application/pdf",
      outputHash: hashSha256(payload.toString("base64")),
      payload,
    };
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
        const serializedSource = serializeCellValue(value);
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
          return serializeCellValue(row[key]);
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
