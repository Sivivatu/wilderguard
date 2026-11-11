import { startReporting, showReportingNotice } from './reporting';
showReportingNotice();
startReporting();
// Keep gameplay independent of reporting initialization and delivery.
void import('./main');
