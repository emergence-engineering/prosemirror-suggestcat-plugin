import { Decoration } from "prosemirror-view";
import {
  DecorationFactory,
  ProcessingUnit,
  ResultDecoration,
  WidgetFactory,
  UnitStatus,
} from "../../types";
import { RandomProcessorMetadata, RandomProcessorResponse } from "./types";

// Decoration factory for successful processing
export const randomProcessorDecorationFactory: DecorationFactory<
  RandomProcessorResponse,
  RandomProcessorMetadata
> = (
  response: RandomProcessorResponse,
  unit: ProcessingUnit<RandomProcessorMetadata>,
): ResultDecoration<RandomProcessorResponse>[] => {
  // Create a decoration spanning the whole unit
  return [
    Decoration.inline(
      unit.from + 1, // Skip the opening tag
      unit.to - 1, // Skip the closing tag
      {
        class: "random-processor-success",
        style: "background-color: rgba(76, 175, 80, 0.2); border-radius: 2px;",
      },
      {
        id: {},
        unitId: unit.id,
        originalText: unit.text,
        response,
        processingTime: response.processingTime,
      },
    ) as ResultDecoration<RandomProcessorResponse>,
  ];
};

// Widget factory for showing loading/error states
export const randomProcessorWidgetFactory: WidgetFactory<RandomProcessorMetadata> = (
  unit: ProcessingUnit<RandomProcessorMetadata>,
): Decoration | undefined => {
  // Create widget based on status
  let content: string;
  let className: string;

  switch (unit.status) {
    case UnitStatus.QUEUED:
      content = "⏳ Queued...";
      className = "random-processor-widget queued";
      break;
    case UnitStatus.PROCESSING:
      content = "⚙️ Processing...";
      className = "random-processor-widget processing";
      break;
    case UnitStatus.BACKOFF:
      const waitTime = Math.max(0, unit.waitUntil - Date.now());
      content = `🔄 Retry in ${Math.ceil(waitTime / 1000)}s (attempt ${unit.retryCount + 1})`;
      className = "random-processor-widget backoff";
      break;
    case UnitStatus.ERROR:
      content = `❌ Failed after ${unit.retryCount} retries`;
      className = "random-processor-widget error";
      break;
    case UnitStatus.DIRTY:
      content = "⚠️ Changed";
      className = "random-processor-widget dirty";
      break;
    case UnitStatus.WAITING:
      content = "⏸️ Waiting...";
      className = "random-processor-widget waiting";
      break;
    default:
      return undefined;
  }

  // Determine background and text color based on status
  let background: string;
  let textColor: string;
  switch (unit.status) {
    case UnitStatus.ERROR:
      background = "#ffebee";
      textColor = "#c62828";
      break;
    case UnitStatus.DIRTY:
      background = "#fff9c4";
      textColor = "#f57f17";
      break;
    case UnitStatus.BACKOFF:
      background = "#fff3e0";
      textColor = "#e65100";
      break;
    default:
      background = "#e3f2fd";
      textColor = "#1565c0";
  }

  // Create a widget at the start of the unit
  const widget = document.createElement("span");
  widget.className = className;
  widget.textContent = content;
  widget.style.cssText = `
    display: inline-block;
    padding: 2px 8px;
    margin-right: 8px;
    font-size: 12px;
    border-radius: 4px;
    background: ${background};
    color: ${textColor};
  `;

  return Decoration.widget(unit.from + 1, widget, { side: -1 });
};
