/* eslint-disable no-console */
import { Plugin } from "prosemirror-state";
import { completeRequest, makeShorterLonger } from "./makeTaksRequest";
import { CompletePluginState, Status, TaskType } from "./types";
import { completePluginKey, isCompleteMeta } from "./utils";

/*
 * new - make request in view
 * streaming - update state in apply method and wait for finished
 * finished - update state in apply method and wait for accepted or rejected
 * accepted - insert/replace text in view and set status to done
 * rejected - set status to done
 * done - clear state
 */
export const completePlugin = (apiKey: string) =>
  new Plugin<CompletePluginState>({
    key: completePluginKey,
    state: {
      init() {
        return {};
      },
      apply(tr, pluginState, prevState, state) {
        const meta = tr.getMeta(completePluginKey);
        console.log({ pluginState, meta });

        if (
          pluginState.status === Status.done ||
          pluginState.status === Status.rejected
        ) {
          return {};
        }

        if (meta && isCompleteMeta(meta)) {
          if (pluginState.type && meta.type !== pluginState.type) {
            return pluginState;
          }

          return {
            ...pluginState,
            ...meta,
          };
        }

        return pluginState;
      },
    },
    view() {
      return {
        update(view, prevState) {
          const pluginState: CompletePluginState = completePluginKey.getState(
            view.state,
          );
          /* eslint-disable prefer-destructuring */
          let tr = view.state.tr;
          if (pluginState.status === Status.new) {
            switch (pluginState.type) {
              case TaskType.complete:
                completeRequest(pluginState, view, apiKey);
                console.log("complete");
                break;
              case TaskType.makeLonger:
              case TaskType.makeShorter:
                makeShorterLonger(pluginState.type, pluginState, view, apiKey);
                console.log("makeShorterLonger");
                break;
              default:
                break;
            }
          }
          if (pluginState.status === Status.accepted) {
            switch (pluginState.type) {
              case TaskType.complete:
                tr = tr.insertText(
                  pluginState.result || "",
                  view.state.doc.nodeSize - 2,
                );
                tr.setMeta(completePluginKey, {
                  type: TaskType.complete,
                  status: Status.done,
                });
                view.dispatch(tr);
                console.log("complete accepted");
                break;
              case TaskType.makeLonger:
              case TaskType.makeShorter:
                if (pluginState.selection) {
                  tr = tr.replaceWith(
                    pluginState.selection.from,
                    pluginState.selection.to,
                    view.state.schema.text(pluginState.result || ""),
                  );
                }
                tr.setMeta(completePluginKey, {
                  type: pluginState.type,
                  status: Status.done,
                });
                view.dispatch(tr);
                console.log("makeShorterLonger accepted");
                break;
              default:
                break;
            }
          }
        },
      };
    },
  });
