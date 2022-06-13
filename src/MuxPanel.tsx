import {
    PanelExtensionContext,
    RenderState,
    Topic,
    MessageEvent,
} from "@foxglove/studio";
import {
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { produce } from "immer";
import { isEqual } from "lodash";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from "react";
import ReactDOM from "react-dom";


type std_msgs__String = {
    data: string;
};


/* eslint-disable @typescript-eslint/no-unused-vars */

// MuxList
// https://github.com/ros/ros_comm/blob/noetic-devel/tools/topic_tools/srv/MuxList.srv
type MuxListRequest = Record<string, never>;
type MuxListResponse = {
    topics: string[];
};

// MuxSelect
// https://github.com/ros/ros_comm/blob/noetic-devel/tools/topic_tools/srv/MuxSelect.srv
type MuxSelectRequest = {
    topic: string;
};
type MuxSelectResponse = {
    prev_topic: string;
};

/* eslint-enable @typescript-eslint/no-unused-vars */


type MuxState = {
    name: string;
    inputs: string[];
    active: string | undefined;
};


function MuxPanel(
    { context }: { context: PanelExtensionContext }
): JSX.Element {
    // A list of mux nodes
    const [muxNodes, setMuxNodes] = useState<string[]>([]);

    // A mapping of mux nodes to their selected and available inputs
    const [muxStates, setMuxStates] = useState<Record<string, MuxState>>({});

    // State copied from the RenderState that Studio gives us
    const [colorScheme, setColorScheme] =
        useState<RenderState["colorScheme"]>();
    const [messages, setMessages] = useState<
        readonly MessageEvent<unknown>[] | undefined
    >();
    const [topics, setTopics] = useState<readonly Topic[] | undefined>();

    const [renderDone, setRenderDone] = useState<(() => void) | undefined>();


    // Some initial setup to wire up React and the panel API
    useLayoutEffect(() => {
        context.onRender = (renderState: RenderState, done) => {
            // Copy from the renderState into our own state objects. Doing so
            // does not invalidate any memoized values unless they've actually
            // been modified.
            setTopics(renderState.topics);
            setMessages(renderState.currentFrame);
            setColorScheme(renderState.colorScheme);

            // We must call the done() callback to signal to Studio that we have
            // finished rendering.
            //
            // This also triggers React to re-render our component, since `done`
            // is different each time.
            setRenderDone(() => done);
        };

        // Watch the context fields that we want to trigger a re-render.
        context.watch("colorScheme");
        context.watch("currentFrame");
        context.watch("topics");
    }, [context]);

    // Use the set of available topics to find any potential mux nodes.
    // This is imperfect, but there is no way to scan for services yet.
    useEffect(() => {
        setMuxNodes(
            (topics ?? [])
                .filter((topic) => (
                    topic.name.endsWith("/selected") &&
                    topic.datatype === "std_msgs/String"
                ))
                .map((topic) => topic.name.replace(/\/selected$/, ""))
        );
    }, [topics]);

    // When mux nodes come or go, update muxStates
    useEffect(() => {
        setMuxStates((prev) => {
            return Object.fromEntries(muxNodes.map((node) => {
                if (node in prev) {
                    // We already knew about this one, keep using it
                    return [node, prev[node]];
                } else {
                    // This is a newly-discovered node
                    return [node, {
                        name: node,
                        inputs: [],  // TBD
                        active: undefined,
                    }];
                }

                // Any nodes no longer present will be forgotten
            })) as (typeof muxStates);
        });
    }, [muxNodes]);


    // Subscribe to all mux nodes' `selected` topics
    useEffect(() => {
        context.subscribe(muxNodes.map((node) => `${node}/selected`));
    }, [context, muxNodes]);

    // Use incoming `selected` messages to update our state, so we reflect
    // changes that happen outside of our panel.
    useEffect(() => {
        setMuxStates((prev) => produce(prev, (draft) => {
            (messages ?? []).forEach((message) => {
                const node = message.topic.replace(/\/selected$/, "");
                const value = (message.message as std_msgs__String).data;
                if (node in draft) {
                    draft[node]!.active = value;
                }
            });
        }));
    }, [messages]);


    // Polls all services for new inputs
    const pollAllInputs = useCallback(() => {
        Object.values(muxStates).forEach((mux) => {
            // Note: no-op if callService is not supported on this data source
            context.callService?.(`${mux.name}/list`, {})
                .then((response) => {
                    setMuxStates((prev) => produce(prev, (draft) => {
                        if (!(mux.name in draft))
                            return;

                        // Be careful not to trigger a re-render if the input
                        // set is actually the same.
                        const newInputs = [
                            "__none",
                            ...(response as MuxListResponse).topics,
                        ];

                        if (!isEqual(draft[mux.name]!.inputs, newInputs)) {
                            draft[mux.name]!.inputs = newInputs;
                        }
                    }));
                })
                .catch((_reason) => {/* no-op */});
        });
    }, [context, muxStates]);

    // Regularly poll the inputs for each mux node
    useEffect(() => {
        pollAllInputs();
        const id = setInterval(pollAllInputs, 1000);
        return () => clearInterval(id);
    }, [context, pollAllInputs]);


    // Callback for when the user changes a selection in our panel
    const onMuxChange = useCallback(
        (mux: MuxState, event: SelectChangeEvent) => {
            // Send the request to the service
            void context.callService?.(
                `${mux.name}/select`,
                { topic: event.target.value } as MuxSelectRequest,
            );

            // Update our view of the state immediately
            setMuxStates((prev) => produce(prev, (draft) => {
                draft[mux.name]!.active = event.target.value;
            }));
        },
        [context]
    );


    // Use the MUI color scheme that matches the user's Studio preference
    const muiTheme = useMemo(() => {
        return createTheme({
            palette: {
                mode: colorScheme ?? "dark",
            },
        });
    }, [colorScheme]);


    // Invoke the done callback once the render is complete
    useEffect(() => {
        renderDone?.();
    }, [renderDone]);


    return (
        <ThemeProvider theme={muiTheme}>
            <Stack sx={{ margin: 2 }} spacing={2}>
                {Object.values(muxStates).map((mux, i) => {
                    return (
                        <FormControl key={i} fullWidth>
                            <InputLabel id={`select-label-${i}`}>
                                {mux.name}
                            </InputLabel>
                            <Select
                                labelId={`select-label-${i}`}
                                value={mux.active}
                                label={mux.name}
                                onChange={(e) => onMuxChange(mux, e)}
                            >
                                {mux.inputs.map((input, j) => {
                                    return (
                                        <MenuItem key={j} value={input}>
                                            {(input === "__none") ?
                                                "None" : input}
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    );
                })}
            </Stack>
        </ThemeProvider>
    );
}

export function initMuxPanel(context: PanelExtensionContext): void {
    ReactDOM.render(<MuxPanel context={context} />, context.panelElement);
}
