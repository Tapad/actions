import { Service } from './service';
import { PagerDutyCreateIncident } from './pagerduty_create_incident';
import { PagerDutyIncident, PagerDutyAlert } from './pagerduty_incident';
import * as Hub from "../../hub";
export declare class PagerDutyClient {
    private apiKey;
    constructor(apiKey: string);
    private PagerDutyEventApi;
    private restApiClient;
    services(): Promise<Service[]>;
    incidents(service: Service): Promise<PagerDutyIncident[]>;
    alerts(incident: PagerDutyIncident): Promise<PagerDutyAlert[]>;
    createIncidents(incidents: PagerDutyCreateIncident[], serviceKeys: string[], scheduleId: string): Promise<Hub.ActionResponse>;
    private getAlertsManagedByLooker;
    private getAlertsToResolve;
}
