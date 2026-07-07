import handler from "@tanstack/react-start/server-entry";
import { criarServerTanstackEvlog } from "@whasap/evlog/tanstack-server";

export default criarServerTanstackEvlog("office", handler);
