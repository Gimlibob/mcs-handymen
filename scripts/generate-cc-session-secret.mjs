#!/usr/bin/env node
/** Print a 48-byte base64url secret for CC_SESSION_SECRET. */
import { randomBytes } from "node:crypto";

console.log(randomBytes(48).toString("base64url"));
