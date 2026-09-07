import { shouldAutoResumeOwnerChat } from './owner-chat';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(shouldAutoResumeOwnerChat(undefined), 'idle undefined');
assert(shouldAutoResumeOwnerChat('ready'), 'idle ready');
assert(shouldAutoResumeOwnerChat('start'), 'idle start');
assert(shouldAutoResumeOwnerChat('owner_chat'), 'already in chat');
assert(!shouldAutoResumeOwnerChat('profile_edit_menu'), 'block profile edit menu');
assert(!shouldAutoResumeOwnerChat('profile_name'), 'block profile name');
assert(!shouldAutoResumeOwnerChat('profile_photo'), 'block profile photo');
assert(!shouldAutoResumeOwnerChat('pet_name'), 'block pet wizard');
assert(!shouldAutoResumeOwnerChat('payment_receipt'), 'block payment');

console.log('owner-chat-resume.selftest: ok');
