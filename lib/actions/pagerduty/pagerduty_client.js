"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagerDutyClient = void 0;
const got_1 = require("got");
const pagerduty_create_incident_1 = require("./pagerduty_create_incident");
const Hub = require("../../hub");
const moment = require("moment");
class PagerDutyClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.PagerDutyEventApi = 'https://events.pagerduty.com/v2';
        this.restApiClient = got_1.default.extend({
            prefixUrl: 'https://api.pagerduty.com',
            headers: {
                'Authorization': `Token token=${this.apiKey}`,
                'Accept': 'application/json'
            }
        });
    }
    services() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.restApiClient.get('services?include[]=integrations').json();
            return res.services;
        });
    }
    incidents(service) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.restApiClient
                .get(`incidents?include[]=incident_key&service_ids[]=${service.id}&statuses[]=triggered&statuses[]=acknowledged`)
                .json();
            return res.incidents;
        });
    }
    alerts(incident) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.restApiClient.get(`incidents/${incident.id}/alerts`).json();
            return res.alerts;
        });
    }
    createIncidents(incidents, serviceKeys, scheduleId) {
        return __awaiter(this, void 0, void 0, function* () {
            const newAlertKeys = incidents.map(i => i.dedup_key);
            incidents.forEach(i => console.info(`Incident "${i.dedup_key}" received on routing key "${i.routing_key}"`));
            const activeAlertsPerRoutingKeyPromise = this.getAlertsManagedByLooker(serviceKeys, scheduleId)
                .then(activeAlertsPerRoutingKey => {
                activeAlertsPerRoutingKey.forEach(keyAndAlerts => {
                    keyAndAlerts.alerts.forEach(a => console.info(`Active alert "${a.alert_key}" on routing key "${keyAndAlerts.routingKey}"`));
                });
                return activeAlertsPerRoutingKey;
            });
            const alertsToResolvePerRroutingKeyPromise = this.getAlertsToResolve(activeAlertsPerRoutingKeyPromise, newAlertKeys)
                .then(alertsPerKeys => {
                alertsPerKeys.forEach(alertsPerKey => alertsPerKey.alerts.forEach(alert => console.info(`Resolving "${alert.alert_key}" on routing key ${alertsPerKey.routingKey}`)));
                return alertsPerKeys;
            });
            const resolveAlertsPromise = alertsToResolvePerRroutingKeyPromise
                .then(keysAndAlerts => keysAndAlerts.flatMap(keyAndAlerts => keyAndAlerts.alerts.map(alert => {
                const resolveIncident = {
                    routing_key: keyAndAlerts.routingKey,
                    event_action: pagerduty_create_incident_1.PagerDutyEventAction.Resolve,
                    dedup_key: alert.alert_key,
                    payload: {
                        summary: "Looker auto-resolving alert",
                        severity: 'warning',
                        source: "Looker actions",
                        timestamp: moment().format(),
                    }
                };
                return resolveIncident;
            })))
                .then(incidents => Promise.all(incidents.map(incident => got_1.default.post(`${this.PagerDutyEventApi}/enqueue`, {
                json: incident
            }))));
            const triggerAlertsPromises = Promise.all(incidents.map(i => got_1.default.post(`${this.PagerDutyEventApi}/enqueue`, {
                json: i
            })));
            return Promise.all([triggerAlertsPromises, resolveAlertsPromise])
                .then(r => {
                const responses = r.reduce((a, b) => a.concat(b));
                const message = `Pushed ${responses.length} alerts (might be deduped) to PagerDuty`;
                console.info(message);
                return new Hub.ActionResponse({ success: true, message: message });
            })
                .catch(reason => {
                const message = `Failed to create PD incidents ${reason}`;
                console.error(message);
                console.log(reason);
                return new Hub.ActionResponse({ success: false, message: message });
            });
        });
    }
    getAlertsManagedByLooker(serviceKeys, scheduleId) {
        const keysAndIncidentsPromise = this.services()
            .then(services => services
            .flatMap(service => service.integrations.map(integration => {
            const serviceAndIntegration = [service, integration];
            return serviceAndIntegration;
        }))
            .filter(serviceAndIntegration => serviceKeys.includes(serviceAndIntegration[1].integration_key))
            .map(serviceAndIntegration => {
            const keysAndService = [serviceAndIntegration[1].integration_key, serviceAndIntegration[0]];
            return keysAndService;
        }))
            .then(keysAndServices => Promise.all(keysAndServices.map(keyAndService => this.incidents(keyAndService[1]).then(incidents => {
            const keysAndIncidents = [keyAndService[0], incidents];
            return keysAndIncidents;
        }))));
        return keysAndIncidentsPromise
            .then(keysAndIncidents => Promise.all(keysAndIncidents.flatMap(keyAndIncidents => keyAndIncidents[1].map(incident => this.alerts(incident).then(alerts => new AlertsPerRoutingKey(keyAndIncidents[0], 
        // TODO: Optional chaining added in TS 3.7
        alerts.filter(a => a.body &&
            a.body.details &&
            a.body.details.managed_by_looker &&
            a.body.details.auto_resolve &&
            a.body.details.schedule_id == scheduleId)))))));
    }
    getAlertsToResolve(activeAlertsPerRoutingKeyPromise, newAlertKeys) {
        return activeAlertsPerRoutingKeyPromise
            .then(keysAndAlerts => keysAndAlerts.map(keyAndAlerts => new AlertsPerRoutingKey(keyAndAlerts.routingKey, keyAndAlerts.alerts.filter(alert => !newAlertKeys.includes(alert.alert_key)))));
    }
}
exports.PagerDutyClient = PagerDutyClient;
class AlertsPerRoutingKey {
    constructor(routingKey, alerts) {
        this.routingKey = routingKey;
        this.alerts = alerts;
    }
}
