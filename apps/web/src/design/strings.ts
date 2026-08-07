/**
 * All user-facing copy lives here so the empathetic, non-preachy voice stays
 * consistent. Written from the user's side of the screen: plain verbs, sentence
 * case, no filler, never clinical.
 */

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
    botQuestions: {
      spiritual: '🙏 How close do you feel to God right now?',
      physical: '💪 How is your body doing right now?',
      emotional: '❤️ How is your heart doing right now?',
      vocational: '💼 How are you feeling about your work or life direction?',
      relational: '🤝 How connected do you feel to the people around you?',
    },
    /** Per-dimension answer copy for the same four underlying state levels — same weather, different words for each part of life. */
    answerLabels: {
      spiritual: { Thriving: 'Thriving', Steady: 'Steady', Heavy: 'Struggling', 'In the Pit': 'In the Pit' },
      physical: { Thriving: 'Strong', Steady: 'Doing OK', Heavy: 'Running Low', 'In the Pit': 'Drained' },
      emotional: { Thriving: 'Thriving', Steady: 'Steady', Heavy: 'Heavy', 'In the Pit': 'In the Pit' },
      vocational: { Thriving: 'Confident', Steady: 'Steady', Heavy: 'Uncertain', 'In the Pit': 'Lost' },
      relational: { Thriving: 'Deeply Connected', Steady: 'Connected', Heavy: 'Disconnected', 'In the Pit': 'Isolated' },
    },
    botNotePrompt: 'Anything you want to add? Totally optional.',
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
    messageCopied: 'Copied — paste it into your messaging app.',
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
    recordRerecord: 'Re-record',
    recordCancel: 'Cancel',
    recordSending: 'Sending…',
    recordMicDenied: ' needs microphone access to record a voice note.',
    voiceNoteFrom: (name: string) => `${name} sent you a voice note`,
    voiceNotePlay: 'Play',
    voiceNotePause: 'Pause',
    voiceNoteReceived: 'Received',
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
    browserNotificationsFailed: "Couldn't enable notifications. Try again.",
    timezone: 'Timezone',
    frequency: 'Check-in frequency',
    frequencyBody: 'How often should we prompt you to check in?',
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
        body: 'Once a day (or as often as you choose), answer one honest question for each part of life. Your answers color your ring, so your circle can see how you’re really doing without you having to explain it.',
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
    inviteBody: 'Share this code. It works once.',
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
