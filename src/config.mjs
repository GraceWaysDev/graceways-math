import {fail} from './errors.mjs';
// Requested by the user, not an assertion of current catalogue availability.
export const preferredModel='nvidia/nemotron-3-super-120b-a12b';
export const baseURL='https://api.tokenfactory.nebius.com/v1/';
export function endpoint(operation){if(!['models','chat/completions'].includes(operation))fail('HOST_BLOCKED');return baseURL+operation;}
export function assertURL(url){if(![endpoint('models'),endpoint('chat/completions')].includes(url))fail('HOST_BLOCKED');return url;}
export function selectModel(configured,catalogue){
 if(configured&&configured!==preferredModel)fail('MODEL_CHANGE_REQUIRES_APPROVAL');
 if(!Array.isArray(catalogue)||!catalogue.includes(preferredModel))fail('MODEL_NOT_AVAILABLE');
 return configured||preferredModel; // Safe default only after authoritative catalogue match.
}
export const defaults=Object.freeze({max_completion_tokens:4096,total_token_budget:30000,max_wire_characters:45000,max_input_characters:20000,max_output_characters:100000,max_source_count:30,max_document_characters:1,max_attempts:1,timeout_seconds:25});
