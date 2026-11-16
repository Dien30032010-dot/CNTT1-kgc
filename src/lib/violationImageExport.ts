import type { ClassDatabase, Student, ViolationRecord } from "../types";
import { formatDateVi, getViolationDateKey } from "./violationDates";

export interface ViolationPrintOptions {
  title: string;
  scopeLabel: string;
  exporterName: string;
  db: ClassDatabase;
  violations: ViolationRecord[];
}

export interface RenderedViolationImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const normalized = (text || "—").replace(/\r\n/g, "\n").trim() || "—";
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        // Break single ultra-long token if needed
        if (ctx.measureText(words[i]).width > maxWidth) {
          let chunk = "";
          for (const ch of words[i]) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = words[i];
        }
      }
    }
    lines.push(current);
  }

  return lines.length > 0 ? lines : ["—"];
}

export async function renderViolationsPrintImage(
  options: ViolationPrintOptions
): Promise<RenderedViolationImage> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const fontFamily =
    '"Plus Jakarta Sans", "Segoe UI", Roboto, Arial, sans-serif';
  const width = 1400;
  const padX = 72;
  const padTop = 64;
  const padBottom = 68;
  const tableWidth = width - padX * 2; // 1256

  const studentMap = new Map<string, Student>(
    options.db.students.map((s) => [s.id, s])
  );

  // Measure pass using temporary canvas context
  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  if (!mCtx) {
    throw new Error("Trình duyệt không hỗ trợ tạo hình ảnh Canvas.");
  }

  const columns = [
    { label: "STT", width: 56, align: "center" as const },
    { label: "Mã SV", width: 136, align: "left" as const },
    { label: "Họ và tên", width: 226, align: "left" as const },
    { label: "Loại lỗi", width: 188, align: "left" as const },
    { label: "Chi tiết", width: 330, align: "left" as const },
    { label: "Ngày vi phạm", width: 148, align: "center" as const },
    { label: "Người ghi", width: 172, align: "left" as const },
  ];

  const cellPadX = 14;
  const cellPadY = 14;
  const lineHeight = 26;
  const headerRowHeight = 48;

  mCtx.font = `500 18px ${fontFamily}`;

  interface PreparedRow {
    cells: string[][];
    height: number;
  }

  const preparedRows: PreparedRow[] = options.violations.map((v, idx) => {
    const stu = studentMap.get(v.sid);
    const values = [
      String(idx + 1),
      v.sid,
      stu?.name || v.sid,
      v.type,
      v.detail?.trim() || "—",
      formatDateVi(getViolationDateKey(v)),
      v.byName?.trim() || "Ban cán sự lớp",
    ];
    const wrapped = values.map((val, colIdx) => {
      mCtx.font =
        colIdx === 2 || colIdx === 3
          ? `600 18px ${fontFamily}`
          : `500 18px ${fontFamily}`;
      return wrapText(mCtx, val, columns[colIdx].width - cellPadX * 2);
    });
    const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
    const height = Math.max(52, maxLines * lineHeight + cellPadY * 2);
    return { cells: wrapped, height };
  });

  const emptyRowHeight = 76;
  const bodyHeight =
    preparedRows.length > 0
      ? preparedRows.reduce((sum, r) => sum + r.height, 0)
      : emptyRowHeight;

  const headerBlockHeight = 205;
  const signatureBlockHeight = 165;
  const totalHeight = Math.max(
    900,
    padTop +
      headerBlockHeight +
      headerRowHeight +
      bodyHeight +
      signatureBlockHeight +
      padBottom
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không thể khởi tạo Canvas 2D.");
  }

  // White print background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  // Subtle outer print frame border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, totalHeight - 48);

  // Top metadata row
  let y = padTop;
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 18px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(options.db.school.toUpperCase(), padX, y);

  ctx.textAlign = "right";
  ctx.font = `600 17px ${fontFamily}`;
  ctx.fillStyle = "#334155";
  ctx.fillText(
    `Ngày xuất phiếu: ${new Date().toLocaleDateString("vi-VN")}`,
    width - padX,
    y
  );

  y += 28;
  ctx.textAlign = "left";
  ctx.font = `600 18px ${fontFamily}`;
  ctx.fillStyle = "#1e3a8a";
  ctx.fillText(`Lớp: ${options.db.className}`, padX, y);

  // Horizontal divider under header info
  y += 38;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  // Report main title
  y += 30;
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 30px ${fontFamily}`;
  ctx.fillText(
    (options.title.trim() || "BẢNG TỔNG HỢP LỖI VI PHẠM").toUpperCase(),
    width / 2,
    y
  );

  y += 44;
  ctx.font = `500 18px ${fontFamily}`;
  ctx.fillStyle = "#475569";
  ctx.fillText(
    `Phạm vi: ${options.scopeLabel}  •  Tổng số lỗi vi phạm: ${options.violations.length}`,
    width / 2,
    y
  );

  y += 48;

  // Table header
  const tableTopY = y;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(padX, tableTopY, tableWidth, headerRowHeight);

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padX, tableTopY, tableWidth, headerRowHeight);

  let colX = padX;
  ctx.font = `700 16px ${fontFamily}`;
  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "middle";

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(colX, tableTopY);
      ctx.lineTo(colX, tableTopY + headerRowHeight);
      ctx.stroke();
    }
    ctx.textAlign = col.align;
    const textX =
      col.align === "center" ? colX + col.width / 2 : colX + cellPadX;
    ctx.fillText(col.label.toUpperCase(), textX, tableTopY + headerRowHeight / 2);
    colX += col.width;
  }

  // Table body
  let rowY = tableTopY + headerRowHeight;
  ctx.textBaseline = "top";

  if (preparedRows.length === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(padX, rowY, tableWidth, emptyRowHeight);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padX, rowY, tableWidth, emptyRowHeight);
    ctx.fillStyle = "#64748b";
    ctx.font = `500 18px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "Không có lỗi vi phạm nào trong phạm vi đã chọn.",
      width / 2,
      rowY + emptyRowHeight / 2
    );
    rowY += emptyRowHeight;
  } else {
    for (let rIdx = 0; rIdx < preparedRows.length; rIdx++) {
      const row = preparedRows[rIdx];
      ctx.fillStyle = rIdx % 2 === 1 ? "#f8fafc" : "#ffffff";
      ctx.fillRect(padX, rowY, tableWidth, row.height);

      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(padX, rowY, tableWidth, row.height);

      let cx = padX;
      ctx.textBaseline = "top";
      for (let cIdx = 0; cIdx < columns.length; cIdx++) {
        const col = columns[cIdx];
        if (cIdx > 0) {
          ctx.beginPath();
          ctx.moveTo(cx, rowY);
          ctx.lineTo(cx, rowY + row.height);
          ctx.stroke();
        }

        if (cIdx === 3) {
          ctx.fillStyle = "#b91c1c";
          ctx.font = `700 18px ${fontFamily}`;
        } else if (cIdx === 2) {
          ctx.fillStyle = "#0f172a";
          ctx.font = `600 18px ${fontFamily}`;
        } else if (cIdx === 1) {
          ctx.fillStyle = "#334155";
          ctx.font = `600 17px "JetBrains Mono", monospace`;
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.font = `500 18px ${fontFamily}`;
        }

        ctx.textAlign = col.align;
        const tx =
          col.align === "center" ? cx + col.width / 2 : cx + cellPadX;
        const lines = row.cells[cIdx];
        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          ctx.fillText(lines[lIdx], tx, rowY + cellPadY + lIdx * lineHeight);
        }

        cx += col.width;
      }

      rowY += row.height;
    }
  }

  // Signature block
  const sigY = rowY + 46;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  const leftSigX = padX + 210;
  const rightSigX = width - padX - 210;

  ctx.fillStyle = "#0f172a";
  ctx.font = `700 18px ${fontFamily}`;
  ctx.fillText("XÁC NHẬN CỦA GVCN / QUẢN LÝ", leftSigX, sigY);
  ctx.fillText("NGƯỜI LẬP PHIẾU", rightSigX, sigY);

  ctx.fillStyle = "#64748b";
  ctx.font = `italic 15px ${fontFamily}`;
  ctx.fillText("(Ký và ghi rõ họ tên)", leftSigX, sigY + 28);
  ctx.fillText("(Ký và ghi rõ họ tên)", rightSigX, sigY + 28);

  if (options.exporterName.trim()) {
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 17px ${fontFamily}`;
    ctx.fillText(options.exporterName.trim(), rightSigX, sigY + 94);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Không thể xuất ảnh PNG."));
      },
      "image/png",
      1
    );
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    blob,
    width,
    height: totalHeight,
  };
}
