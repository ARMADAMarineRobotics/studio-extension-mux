import { ExtensionContext } from "@foxglove/studio";

import { initMuxPanel } from "./MuxPanel";

export function activate(extensionContext: ExtensionContext): void {
    extensionContext.registerPanel({
        name: "Mux",
        initPanel: initMuxPanel,
    });
}
