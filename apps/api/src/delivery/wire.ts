import { circleNotificationService } from '../modules/notifications/circle-notification.service';
import { touchpointService } from '../modules/touchpoints/touchpoints.service';
import { voiceNoteService } from '../modules/voicenotes/voicenotes.service';
import { messageService } from '../modules/messages/messages.service';
import { circleService } from '../modules/circles/circles.service';
import { notifierService } from './notifier.service';

/**
 * Wire the concrete delivery layer into the domain services. Call once at
 * process startup (HTTP server AND worker), before serving traffic. This is
 * the single place the domain core and the transport layer are joined; the
 * domain never imports the notifier directly.
 */
let wired = false;

export function wireDelivery(): void {
  if (wired) return;
  circleNotificationService.setDispatcher(notifierService);
  touchpointService.setAckDispatcher(notifierService);
  voiceNoteService.setDispatcher(notifierService);
  messageService.setDispatcher(notifierService);
  circleService.setEventDispatcher(notifierService);
  wired = true;
}
