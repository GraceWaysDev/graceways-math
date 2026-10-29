import {DurableObject} from 'cloudflare:workers';
import {createCloudflareHandler} from './handler.mjs';

export class MathDemo extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.handle = createCloudflareHandler(ctx.storage, env);
  }
  fetch(request) { return this.handle(request); }
}

export default {
  async fetch(request, env) {
    try {
      // No client-controlled object names; this isolated demo uses one instance.
      return await env.MATH_DEMO.get(env.MATH_DEMO.idFromName('jury-demo-v1')).fetch(request);
    } catch {
      return new Response('Demo unavailable. Contact the owner.', {status: 503, headers: {'Cache-Control': 'no-store'}});
    }
  }
};
