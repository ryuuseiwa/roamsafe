import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;
import("./App").then(({ mount }) => mount());
