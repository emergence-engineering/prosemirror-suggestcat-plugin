import { Plugin, PluginKey } from "prosemirror-state";
import { blockRunnerPlugin, createBlockRunnerKey } from "../../plugin";
import { RunnerState } from "../../types";
import { linkDetectorDecorationFactory } from "./decorations";
import { linkDetectorProcessor } from "./processor";
import {
  LinkDetectorContext,
  LinkDetectorMetadata,
  LinkDetectorResponse,
} from "./types";

// Plugin key for link detector
export const linkDetectorKey = createBlockRunnerKey<
  LinkDetectorResponse,
  LinkDetectorContext,
  LinkDetectorMetadata
>("linkDetector");

// Create the link detector plugin
export function createLinkDetectorPlugin(): Plugin<
  RunnerState<LinkDetectorResponse, LinkDetectorContext, LinkDetectorMetadata>
> {
  const basePlugin = blockRunnerPlugin<
    LinkDetectorResponse,
    LinkDetectorContext,
    LinkDetectorMetadata
  >({
    pluginKey: linkDetectorKey,
    unitProcessor: linkDetectorProcessor,
    decorationFactory: linkDetectorDecorationFactory,
    initialContextState: {},
  });

  // Wrap with click handler for opening links
  return new Plugin({
    key: linkDetectorKey as PluginKey,
    state: basePlugin.spec.state,
    props: {
      ...basePlugin.spec.props,
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target as HTMLElement;

          // Check if clicked on a link decoration
          if (target.classList.contains("link-detected")) {
            const pos = view.posAtDOM(target, 0);
            const state = linkDetectorKey.getState(view.state);

            if (state) {
              // Find the decoration at this position
              const decoration = state.decorations.find(
                (d) => d.from <= pos && d.to >= pos && d.spec.url,
              );

              if (decoration?.spec.url) {
                window.open(decoration.spec.url as string, "_blank");
                event.preventDefault();
                return true;
              }
            }
          }

          return false;
        },
      },
    },
    view: basePlugin.spec.view,
  });
}
