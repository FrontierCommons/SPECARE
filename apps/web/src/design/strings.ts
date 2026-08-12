/**
 * All user-facing copy lives here so the empathetic, non-preachy voice stays
 * consistent. Written from the user's side of the screen: plain verbs, sentence
 * case, no filler, never clinical.
 */

import type { CheckInDimension, StateLevel, TouchpointType } from '@sper/shared-types';

interface AnswerOption {
  icon: string;
  label: string;
}

/** Every question variant carries its own four options — the wording AND
 * the icon change per question, not just per state level, so these can't be
 * looked up generically off `stateVisual`. Order is always best → worst,
 * matching STATE_LEVELS (Thriving, Steady, Heavy, In the Pit). */
interface QuestionVariant {
  text: string;
  options: Record<StateLevel, AnswerOption>;
}

type QuestionBank = readonly [QuestionVariant, QuestionVariant, QuestionVariant, QuestionVariant, QuestionVariant];

/** Five question variants per dimension so the daily check-in doesn't ask
 * the exact same words (or the same four canned answers) every day. */
const BOT_QUESTION_BANKS: Record<CheckInDimension, QuestionBank> = {
  spiritual: [
    {
      text: '🙏 How has God felt to you now?',
      options: {
        Thriving: { icon: '🌱', label: 'Close and present' },
        Steady: { icon: '🌤️', label: 'Sometimes close, sometimes distant' },
        Heavy: { icon: '🌫️', label: 'Distant lately' },
        'In the Pit': { icon: '❓', label: 'Hard to tell' },
      },
    },
    {
      text: '🙏 How’s your time with God been lately?',
      options: {
        Thriving: { icon: '🙏', label: 'Consistent and meaningful' },
        Steady: { icon: '🌱', label: 'Somewhat consistent' },
        Heavy: { icon: '🌫️', label: 'Hard to make time' },
        'In the Pit': { icon: '💤', label: 'Haven’t really connected lately' },
      },
    },
    {
      text: '🙏 Does God feel near or far today?',
      options: {
        Thriving: { icon: '🫶', label: 'Very near' },
        Steady: { icon: '🌤️', label: 'Somewhat near' },
        Heavy: { icon: '🌫️', label: 'Somewhat distant' },
        'In the Pit': { icon: '🌑', label: 'Very distant' },
      },
    },
    {
      text: '🙏 How’s your faith holding up right now?',
      options: {
        Thriving: { icon: '🌱', label: 'Strong' },
        Steady: { icon: '🌤️', label: 'Doing okay' },
        Heavy: { icon: '🌊', label: 'Uncertain' },
        'In the Pit': { icon: '🪨', label: 'Difficult right now' },
      },
    },
    {
      text: '🙏 Have you sensed God’s presence lately?',
      options: {
        Thriving: { icon: '✨', label: 'Often' },
        Steady: { icon: '🌤️', label: 'Sometimes' },
        Heavy: { icon: '🌫️', label: 'Not much' },
        'In the Pit': { icon: '❓', label: 'I’m not sure' },
      },
    },
  ],
  physical: [
    {
      text: '💪 How is your body doing right now?',
      options: {
        Thriving: { icon: '💪', label: 'Feeling good' },
        Steady: { icon: '🌤️', label: 'Doing okay' },
        Heavy: { icon: '😮‍💨', label: 'A little exhausted' },
        'In the Pit': { icon: '🪫', label: 'Really drained' },
      },
    },
    {
      text: '💪 What’s your energy level now?',
      options: {
        Thriving: { icon: '⚡', label: '100%' },
        Steady: { icon: '🙂', label: '60%' },
        Heavy: { icon: '😮‍💨', label: '40%' },
        'In the Pit': { icon: '🪫', label: '10%' },
      },
    },
    {
      text: '💪 Is your sleeping okay?',
      options: {
        Thriving: { icon: '🌱', label: 'Yes, pretty consistent' },
        Steady: { icon: '🌤️', label: 'Mostly' },
        Heavy: { icon: '😴', label: 'Okay but a bit difficult' },
        'In the Pit': { icon: '😴', label: 'Sleep deprived' },
      },
    },
    {
      text: '💪 How rested does your body feel right now?',
      options: {
        Thriving: { icon: '😌', label: 'Well rested' },
        Steady: { icon: '🙂', label: 'Somewhat rested' },
        Heavy: { icon: '😮‍💨', label: 'A little tired' },
        'In the Pit': { icon: '🪫', label: 'Completely drained' },
      },
    },
    {
      text: '💪 Any aches, exhaustion, or health worries lately?',
      options: {
        Thriving: { icon: '🌱', label: 'No, feeling good' },
        Steady: { icon: '🌤️', label: 'A few minor things' },
        Heavy: { icon: '😮‍💨', label: 'Something has been bothering me' },
        'In the Pit': { icon: '🆘', label: 'It’s affecting my day-to-day life' },
      },
    },
  ],
  emotional: [
    {
      text: '❤️ How is your heart doing right now?',
      options: {
        Thriving: { icon: '🌱', label: 'Light and peaceful' },
        Steady: { icon: '🌤️', label: 'A little heavy' },
        Heavy: { icon: '🌧️', label: 'Pretty heavy' },
        'In the Pit': { icon: '🌊', label: 'Overwhelmed' },
      },
    },
    {
      text: '❤️ What’s your mood been like lately?',
      options: {
        Thriving: { icon: '😊', label: 'Mostly positive' },
        Steady: { icon: '🙂', label: 'Up and down' },
        Heavy: { icon: '😕', label: 'Mostly difficult' },
        'In the Pit': { icon: '😔', label: 'Really low' },
      },
    },
    {
      text: '❤️ Feeling more at peace or more anxious lately?',
      options: {
        Thriving: { icon: '🕊️', label: 'Mostly at peace' },
        Steady: { icon: '🌤️', label: 'A mix of both' },
        Heavy: { icon: '🌊', label: 'Uncertain' },
        'In the Pit': { icon: '😣', label: 'I’m anxious' },
      },
    },
    {
      text: '❤️ How heavy is your emotional feeling now?',
      options: {
        Thriving: { icon: '🌱', label: 'Light' },
        Steady: { icon: '🌤️', label: 'Manageable' },
        Heavy: { icon: '🌧️', label: 'Heavy' },
        'In the Pit': { icon: '🌊', label: 'Overwhelming' },
      },
    },
    {
      text: '❤️ Does your heart feel light or weighed down right now?',
      options: {
        Thriving: { icon: '☀️', label: 'Light' },
        Steady: { icon: '🌤️', label: 'A little weighed down' },
        Heavy: { icon: '🌧️', label: 'Pretty weighed down' },
        'In the Pit': { icon: '🌧️', label: 'Very heavy' },
      },
    },
  ],
  vocational: [
    {
      text: '💼 How are you feeling about your work or life direction?',
      options: {
        Thriving: { icon: '🧭', label: 'I feel on track' },
        Steady: { icon: '🌤️', label: 'Still figuring it out' },
        Heavy: { icon: '🌀', label: 'Feeling a little lost' },
        'In the Pit': { icon: '🧱', label: 'Feeling stuck' },
      },
    },
    {
      text: '💼 Does your work feel meaningful right now?',
      options: {
        Thriving: { icon: '✨', label: 'Very meaningful' },
        Steady: { icon: '🙂', label: 'Somewhat meaningful' },
        Heavy: { icon: '😐', label: 'Not really' },
        'In the Pit': { icon: '🌫️', label: 'I’m questioning my direction' },
      },
    },
    {
      text: '💼 How’s your sense of purpose lately?',
      options: {
        Thriving: { icon: '🧭', label: 'Strong' },
        Steady: { icon: '🌤️', label: 'Fairly steady' },
        Heavy: { icon: '🌫️', label: 'Unclear' },
        'In the Pit': { icon: '🌀', label: 'I’m struggling to find purpose' },
      },
    },
    {
      text: '💼 Feeling stuck or moving forward right now?',
      options: {
        Thriving: { icon: '🚀', label: 'Moving forward' },
        Steady: { icon: '🌱', label: 'Making slow progress' },
        Heavy: { icon: '🌀', label: 'Not sure' },
        'In the Pit': { icon: '🧱', label: 'Feeling stuck' },
      },
    },
    {
      text: '💼 How’s work been treating you lately?',
      options: {
        Thriving: { icon: '😊', label: 'Going well' },
        Steady: { icon: '🙂', label: 'Mostly okay' },
        Heavy: { icon: '😮‍💨', label: 'It’s been draining' },
        'In the Pit': { icon: '🧱', label: 'It’s been really difficult' },
      },
    },
  ],
  relational: [
    {
      text: '🤝 How connected do you feel to the people around you?',
      options: {
        Thriving: { icon: '🫶', label: 'Very connected' },
        Steady: { icon: '🙂', label: 'Fairly connected' },
        Heavy: { icon: '🌫️', label: 'A little disconnected' },
        'In the Pit': { icon: '🥀', label: 'Very disconnected' },
      },
    },
    {
      text: '🤝 Do the people around you really know what’s going on with you?',
      options: {
        Thriving: { icon: '🫶', label: 'Yes, I feel known' },
        Steady: { icon: '🙂', label: 'Somewhat' },
        Heavy: { icon: '🌫️', label: 'Not really' },
        'In the Pit': { icon: '🤐', label: 'I keep most things to myself' },
      },
    },
    {
      text: '🤝 How are your closest relationships feeling lately?',
      options: {
        Thriving: { icon: '❤️', label: 'Strong and healthy' },
        Steady: { icon: '🙂', label: 'Mostly good' },
        Heavy: { icon: '🌤️', label: 'A little strained' },
        'In the Pit': { icon: '🌧️', label: 'Difficult right now' },
      },
    },
    {
      text: '🤝 Do you feel supported by the people around you?',
      options: {
        Thriving: { icon: '🫶', label: 'Very supported' },
        Steady: { icon: '🙂', label: 'Somewhat supported' },
        Heavy: { icon: '🌫️', label: 'Not much' },
        'In the Pit': { icon: '🥀', label: 'I feel alone' },
      },
    },
    {
      text: '🤝 Lonely or well-connected lately?',
      options: {
        Thriving: { icon: '🫶', label: 'Well connected' },
        Steady: { icon: '🙂', label: 'Mostly connected' },
        Heavy: { icon: '🌫️', label: 'Sometimes lonely' },
        'In the Pit': { icon: '🥀', label: 'Often lonely' },
      },
    },
  ],
};

/** Same rotation index for every dimension, so a whole check-in uses one
 * "day's" set of questions rather than desyncing per dimension. Advances
 * once per calendar day (UTC) — stable across repeat check-ins on the same
 * day, different the next. */
function rotatingQuestionIndex(): number {
  return Math.floor(Date.now() / 86_400_000) % 5;
}

function todaysVariant(dim: CheckInDimension): QuestionVariant {
  return BOT_QUESTION_BANKS[dim][rotatingQuestionIndex()]!;
}

export const strings = {
  app: {
    name: 'SPECARE',
    tagline: 'SPEak your CARE! Friends connected! Faith rooted!',
    
  },

  nav: {
    today: 'Today',
    checkIn: 'Check in',
    circle: 'Circle',
    settings: 'Settings',
  },

  auth: {
    pitchBody:
      'A small circle of friends, be honest about spiritual, physical, emotional, work, and relational. When someone’s having a hard season, there are some who love you and care for you with a voice note, a message, or a prayer.',
    verse: "A friend loves at all times, and a brother is born for adversity. Proverbs 17:17",
    signInTitle: 'Welcome back',
    signUpTitle: 'Create your account',
    email: 'Email',
    password: 'Password',
    name: 'Your name',
    signIn: 'Sign in',
    signUp: 'Create account',
    magicLink: 'Email me a sign-in link',
    toggleToSignUp: 'New here? Create an account',
    toggleToSignIn: 'Already have an account? Sign in',
    invalid: 'That email or password didn’t work. Try again.',
    forgotPassword: 'Forgot password?',
    resetTitle: 'Reset your password',
    resetBody: 'Enter your email and we’ll send you a reset code.',
    resetSent: 'If that email has an account, a reset code is on its way. Enter it below with a new password.',
    sendResetCode: 'Send reset code',
    resetCode: 'Reset code',
    newPassword: 'New password',
    resetPasswordCta: 'Set new password',
    backToSignIn: '‹ Back to sign in',
  },

  onboarding: {
    timezoneTitle: 'When’s a good time to check in?',
    timezonePrompt: 'Pick the timezone you’re usually in.',
    timezoneBody: 'We’ll send your quiet daily nudge around 9am your time.',
    confirmTimezone: 'Confirm timezone',
    looksRight: 'Looks right',
    changeTimezone: 'Change timezone',
    joinTitle: 'Start or join a circle',
    joinBody: 'A circle is a few people who agree to notice each other.',
    createCircle: 'Start a new circle',
    circleName: 'Name your circle',
    joinCircle: 'Join with a code',
    code: '6-character code',
    join: 'Join',
    create: 'Create',
  },

  pact: {
    title: 'The Circle Pact',
    body: 'We check in honestly. We notice when someone is heavy. We show up off-app when called upon.',
    checkboxLabel: 'I’ve read this and agree to it.',
    agree: 'I agree',
    subtext: 'Everyone agrees before the circle opens.',
  },

  sper: {
    title: 'Your circle',
    empty: 'No check-ins yet today. Yours can be the first!',
    checkInCta: 'Wanna update your SPECARE?',
    checkInCtaFirst: 'Wanna check-in the first time today?',
    nextCheckIn: (t: string) => `Next check-in in ${t}`,
    quietFor: (name: string) => `${name} has been quiet for a bit`,
    newSection: 'New',
    respondedSection: 'Already responded',
    newEmpty: 'You’ve caught up with everyone!',
    respondedEmpty: "You haven't responded to anything yet.",
  },

  checkIn: {
    title: 'Share SPECARE with your friends',
    subtitle: 'Speak your care today. No wrong answers.',
    notePlaceholder: 'Any quick context? Or prayer (optional)',
    submit: 'Share with my circle',
    dimensions: {
      spiritual: 'Spiritual',
      physical: 'Physical',
      emotional: 'Emotional',
      vocational: 'Career / Life',
      relational: 'Relational',
    },
    botIntro: 'Hey — quick check-in. Just five taps, honestly answered.',
    /** Today's pick from that dimension's 5-question bank. */
    botQuestion(dim: CheckInDimension): string {
      return todaysVariant(dim).text;
    },
    /** Today's icon + label for one of the four levels, for whichever
     * question variant is showing right now. */
    answerOption(dim: CheckInDimension, level: StateLevel): AnswerOption {
      return todaysVariant(dim).options[level];
    },
    explainOption: { icon: '💬', label: 'I want to clarify' },
    explainIntro: 'Share what you have on your mind (if comfortable)',
    explainPlaceholder: 'What’s going on? (Optional)',
    explainLevelPrompt: 'Where on the scale are you feeling in this area?',
    explainCancel: 'Cancel',
    botNotePrompt: 'Anything you want to add? (Optional)',
    botOutro: 'Got it. Sending this to your circle.',
    notePlaceholderShort: 'Type a note…',
    send: 'Send',
    skip: 'Skip',
    changeAnswer: 'Change',
    resultTitle: 'Your check-in',
    resultSubtitle: (rel: string) => `Last updated ${rel}`,
    update: 'Update my check-in',
    done: 'Done',
    changeFrequency: 'Change how often you check in',
  },

  care: {
    cardTitle: (name: string) => `${name} could use some care`,
    guidance: 'Encouraging your friends by:',
    sendVoiceNote: 'Send a voice note',
    sendMessage: 'Send a message',
    call: 'Call',
    pray: 'I prayed',
    logCare: 'I reached out',
    alreadyReached: (names: string) => `${names} already reached out`,
    acked: (name: string) => `${name} stepped up to hold space for you today.`,
    thankYou: 'Thank you!',
    gratitudeSent: 'You thanked everyone who reached out.',
    gratitudeReceived: (name: string) => `${name} wants to show gratitude for your care!`,
    selfTitle: 'You could use some care',
    treeTitle: 'Your tree today',
    thrivingCaption: 'Growing steady — thanks for checking in.',
    responseCount: (n: number) =>
      n === 1 ? 'Someone has watered your tree today.' : `${n} people have watered your tree today.`,
    encouragement: 'Someone already cares for you!',
    prayerToast: 'Someone just prayed for you.',
    recordTapToStart: 'Tap to record',
    recording: 'Recording…',
    recordStop: 'Stop',
    recordSend: 'Send',
    recordPreviewHint: 'Tap to listen before you send it.',
    recordRerecord: 'Re-record',
    recordCancel: 'Cancel',
    recordSending: 'Sending…',
    recordMicDenied: ' needs microphone access to record a voice note.',
    voiceNoteFrom: (name: string) => `${name} sent you a voice note`,
    voiceNotePlay: 'Play',
    voiceNotePause: 'Pause',

    messagePlaceholder: 'Write something encouraging…',
    messageSend: 'Send',
    messageCancel: 'Cancel',
    messageSending: 'Sending…',
    messageFrom: (name: string) => `${name} sent you a message`,
    thankedVoiceNote: (name: string) => `You thanked ${name} for their voice note!`,
    thankedMessage: (name: string) => `You thanked ${name} for their message!`,

    /** Verb phrase for each touchpoint type, used to build "You [verb] X!"
     * once a Care Card's flagged part has been cared for. */
    actionVerb: {
      PrayedFor: 'prayed for',
      TextSent: 'sent a message to',
      VoiceNoteSent: 'sent a voice note to',
      CallMade: 'called',
    } as Record<TouchpointType, string>,
    youActionedFor: (verbs: string[], name: string) => `You ${verbs.join(' and ')} ${name}!`,

    wantsToShare: (name: string) => `${name} wants to share something special!`,
    youShared: 'You shared to everyone!',
    otherNotes: 'Other notes',
    like: 'Like',
    liked: 'Liked',
    likeCount: (n: number) => (n === 1 ? '1 like' : `${n} likes`),
    reactedTooltip: (n: number) => (n === 1 ? '1 person reacted!' : `${n} people reacted!`),
  },

  member: {
    detailTitle: 'Check-in',
    noCheckIn: 'No check-in yet — nothing to see here.',
    lastCheckIn: (rel: string) => `Checked in ${rel}`,
    close: 'Close',
  },

  settings: {
    title: 'Settings',
    profile: 'Profile',
    notifications: 'Notifications',
    notificationsBody: 'Pause your daily check-in nudge without leaving your circle.',
    pauseNudge: 'Pause daily nudge',
    browserNotifications: 'Browser notifications',
    browserNotificationsBody: 'Get a notification here when it’s time for your check-in.',
    browserNotificationsBlocked:
      'Blocked in your browser’s site settings. Allow notifications for this site to turn it on.',
    browserNotificationsEnabled: 'Enabled ✓',
    enableBrowserNotifications: 'Enable',
    disableBrowserNotifications: 'Disable',
    browserNotificationsFailed: "Couldn't enable notifications. Try again.",
    browserNotificationsDisableFailed: "Couldn't disable notifications. Try again.",
    timezone: 'Timezone',
    frequency: 'Check-in frequency',
    frequencyBody: 'How often should we prompt you to check in?',
    nextReminder: (when: string) => `Next reminder around ${when}`,
    frequencyOnce: 'Once a day',
    frequencyTwice: 'Twice a day',
    frequencyThrice: 'Three times a day',
    aboutCircle: 'About this circle',
    viewPact: 'Review the pact',
    tutorial: 'Tutorial',
    signOut: 'Sign out',
    version: 'SPECARE · version 0.1.0',

    changePhoto: 'Change photo',
    photoFailed: "Couldn't update your photo. Try again.",
    confirmPhotoTitle: 'Use this photo?',
    confirmPhotoBody: 'This is what your circle will see. You can change it again anytime.',
    confirmPhotoCta: 'Use this photo',

    frequencyConfirmTitle: 'Change check-in frequency?',
    frequencyConfirmBody: (label: string) => `Switch to "${label}"? This changes how often you're prompted to check in.`,
    frequencyConfirmCta: 'Change frequency',

    deleteAccount: 'Delete my account',
    deleteAccountTitle: 'Delete your account?',
    deleteAccountBody:
      'This permanently removes your profile, check-ins, and circle memberships. Your circle keeps its history, but it will no longer show you. This can’t be undone.',
    deleteAccountPhrase: 'DELETE',
    deleteAccountHint: (phrase: string) => `Type ${phrase} to confirm.`,
    deleteAccountCta: 'Delete my account',
    deleteAccountFailed: "Couldn't delete your account. Try again.",
  },

  tutorial: {
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    done: 'Got it',
    progress: (step: number, total: number) => `${step} of ${total}`,
    steps: [
      {
        title: 'Your circle, at a glance',
        body: 'Each person’s ring is split into five parts of life — spiritual, physical, emotional, career, and relational,. The color of each slice shows how that part is going today, from clear skies to a harder season.',
      },
      {
        title: 'A daily check-in',
        body: 'Once a day (or as often as you choose), answer one honest question for each part of life. Your answers color your ring, so your circle can see how you’re really doing without you having to explain it. If none of the options quite fit, add your own words and just pick whichever color comes closest — no label, just the color:',
      },
      {
        title: 'The Care Card',
        body: 'When someone’s Heavy or In the Pit, a Care Card appears for them. It changes as things move: ways to help while no one’s reached out yet, who’s already stepped up once someone has, and a quiet thank-you once they respond.',
      },
      {
        title: 'Show up, keep the tree green',
        body: 'Send a voice note, send a message, or simply pray — any one lets someone know they’re not alone. Every bit of care keeps their tree green and growing; left too long, it starts to wither. Notice, and show up — that’s the whole idea.',
      },
    ],
    /** What each ring/check-in color means, ordered best → worst to match
     * STATE_LEVELS. Shown in the tutorial legend since the color-only picker
     * in the check-in flow carries no text of its own. */
    colorMeaning: {
      Thriving: 'Clear skies, the best it gets.',
      Steady: 'Calm and holding steady.',
      Heavy: 'Clouds rolling in, a harder day.',
      'In the Pit': 'Storm clouds, running on empty.',
    },
  },

  grace: {
    banner: (name: string) =>
      `${name} has been quiet for a couple of weeks. No pressure — just drop a note to say you love them.`,
  },

  circle: {
    title: 'My circle',
    yourCircles: 'Your circles',
    joinAnother: '+ Join another circle',
    invite: 'Invite someone',
    inviteBody: 'Share this code. Anyone can join with it for the next 24 hours.',
    members: 'Members',
    leave: 'Leave circle',
    pactAgreed: 'Agreed',
    pactPending: 'Pact pending',
  },

  common: {
    retry: 'Try again',
    loading: 'One moment…',
    error: 'Something went wrong. Try again.',
    cancel: 'Cancel',
  },
} as const;

export default strings;
