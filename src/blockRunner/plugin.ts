import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { mergeOptions } from "./defaults";
import { executeParallel, hasUnitsToProcess } from "./executor";
import { createInitialState, handleAction } from "./state";
import {
  ActionType,
  DecorationFactory,
  DecorationTransformer,
  PartialRunnerOptions,
  ResultDecoration,
  RunnerState,
  RunnerStatus,
  UnitProcessor,
  UnitStatus,
  WidgetFactory,
} from "./types";
import { dispatchAction, remapPositions } from "./utils";

export interface BlockRunnerPluginConfig<
  ResponseType,
  ContextState,
  UnitMetadata,
> {
  // Plugin identification
  pluginKey: PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>>;

  // Core processing
  unitProcessor: UnitProcessor<ResponseType, UnitMetadata>;
  decorationFactory: DecorationFactory<ResponseType, UnitMetadata>;

  // Optional transformers
  decorationTransformer?: DecorationTransformer<
    ResponseType,
    ContextState,
    UnitMetadata
  >;
  widgetFactory?: WidgetFactory<UnitMetadata>;

  // Initial state
  initialContextState: ContextState;

  // Options (partial, merged with defaults)
  options?: PartialRunnerOptions<ResponseType, ContextState, UnitMetadata>;

  // Optional keyboard handler
  handleKeyDown?: (
    view: Parameters<NonNullable<Plugin["props"]["handleKeyDown"]>>[0],
    event: Parameters<NonNullable<Plugin["props"]["handleKeyDown"]>>[1],
  ) => boolean | void;
}

// Main plugin factory
export function blockRunnerPlugin<ResponseType, ContextState, UnitMetadata>(
  config: BlockRunnerPluginConfig<ResponseType, ContextState, UnitMetadata>,
): Plugin<RunnerState<ResponseType, ContextState, UnitMetadata>> {
  const {
    pluginKey,
    unitProcessor,
    decorationFactory,
    decorationTransformer,
    widgetFactory,
    initialContextState,
    options: partialOptions,
    handleKeyDown,
  } = config;

  const mergedOptions = mergeOptions<ResponseType, ContextState, UnitMetadata>(
    partialOptions ?? {},
  );

  let isRunning = false;

  return new Plugin<RunnerState<ResponseType, ContextState, UnitMetadata>>({
    key: pluginKey,

    state: {
      init(): RunnerState<ResponseType, ContextState, UnitMetadata> {
        return createInitialState<ResponseType, ContextState, UnitMetadata>(
          initialContextState,
          mergedOptions,
        );
      },

      apply(
        tr,
        state,
        oldEditorState,
        newEditorState,
      ): RunnerState<ResponseType, ContextState, UnitMetadata> {
        // Handle dispatched actions - check for action first to detect self-calls
        const action = tr.getMeta(pluginKey);

        // Detect self-change: docChanged AND plugin meta present
        const isSelfChange = tr.docChanged && action !== undefined;
        const shouldSkipDirty =
          isSelfChange && mergedOptions.dirtyHandling.skipDirtyOnSelfChange;

        let newState = state;

        // Handle document changes - remap positions
        if (tr.docChanged) {
          newState = remapPositions(
            state,
            tr,
            oldEditorState,
            mergedOptions,
            shouldSkipDirty,
          );
        }

        // Handle dispatched actions
        if (action) {
          const newPluginState = handleAction(
            newState,
            action,
            decorationFactory,
            newEditorState,
          );

          // Call onUpdate callback if provided
          if (mergedOptions.onUpdate) {
            mergedOptions.onUpdate(newPluginState);
          }

          return newPluginState;
        }

        return newState;
      },
    },

    props: {
      decorations(editorState): DecorationSet {
        const state = pluginKey.getState(editorState);
        if (!state) return DecorationSet.empty;

        // Filter visible decorations
        let decorations: ResultDecoration<ResponseType>[] =
          state.decorations.filter((d) =>
            mergedOptions.visibilityFilter(d, state.contextState),
          );

        // Transform decorations (e.g., highlight selected)
        if (decorationTransformer) {
          decorations = decorationTransformer(decorations, state);
        }

        // Add loading widgets for processing units (including DIRTY when paused)
        const widgets: Decoration[] = [];
        if (widgetFactory && state.unitsInProgress) {
          for (const unit of state.unitsInProgress) {
            // Show widgets for non-finished units
            if (
              unit.status !== UnitStatus.DONE &&
              unit.status !== UnitStatus.ERROR
            ) {
              const widget = widgetFactory(unit);
              if (widget) widgets.push(widget);
            }
          }
        }

        return DecorationSet.create(editorState.doc, [
          ...decorations,
          ...widgets,
        ]);
      },

      handleKeyDown,
    },

    view() {
      return {
        update(view) {
          const state = pluginKey.getState(view.state);
          if (!state) return;

          // Start execution if active and not already running
          if (
            state.status === RunnerStatus.ACTIVE &&
            !isRunning &&
            hasUnitsToProcess(state)
          ) {
            isRunning = true;

            executeParallel(
              pluginKey,
              view,
              unitProcessor,
              mergedOptions,
            ).finally(() => {
              isRunning = false;

              // Check if we should dispatch FINISH
              // Only auto-finish if shouldRecalculate is false
              // (if true, stay ACTIVE so dirty units can be reprocessed)
              const currentState = pluginKey.getState(view.state);
              if (
                currentState &&
                currentState.status === RunnerStatus.ACTIVE &&
                !hasUnitsToProcess(currentState) &&
                !mergedOptions.dirtyHandling.shouldRecalculate
              ) {
                dispatchAction(view, pluginKey, { type: ActionType.FINISH });
              }
            });
          }
        },
      };
    },
  });
}

// Helper to create a plugin key
export function createBlockRunnerKey<ResponseType, ContextState, UnitMetadata>(
  name: string,
): PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>> {
  return new PluginKey<RunnerState<ResponseType, ContextState, UnitMetadata>>(
    name,
  );
}
