import * as Hub from '../../hub';
import { PagerDutyCreateIncident } from './pagerduty_create_incident';
import { ParamMap } from '../../hub';
declare enum FormFields {
    ServiceKeyKey = "service_key",
    DeDeuplicationIdColumnKey = "deduplication_id_column",
    ScheduleIdKey = "schdeule_id",
    AutoResolveKey = "auto_resolution_boolean",
    MaxIncidentsKey = "max_incidents",
    Summary = "summary",
    Severity = "severity",
    Message = "message"
}
declare enum Severity {
    Critical = "critical",
    Error = "error",
    Warning = "warning",
    Info = "info"
}
interface IPagerDutyForm {
    [FormFields.ServiceKeyKey]: string;
    [FormFields.DeDeuplicationIdColumnKey]: string;
    [FormFields.ScheduleIdKey]: string;
    [FormFields.AutoResolveKey]: boolean;
    [FormFields.MaxIncidentsKey]: number;
    [FormFields.Summary]: string;
    [FormFields.Message]: string;
    [FormFields.Severity]: Severity;
}
export declare class PagerDutyForm {
    service_key: string;
    deduplication_id_column: string;
    schedule_id: string;
    auto_resolution_boolean: boolean;
    max_incidents: number;
    summary: string;
    severity: Severity;
    message: string;
    static formFields: Hub.ActionFormField[];
    static jsonToInterface(json: ParamMap): IPagerDutyForm;
    static create(json: ParamMap): PagerDutyForm;
    constructor(service_key: string, deduplication_id_column: string, schedule_id: string, auto_resolution_boolean: boolean, max_incidents: number, summary: string, severity: Severity, message: string);
    createPagerDutyIncidents(resultSet: any[], plan: Hub.ActionScheduledPlan): Hub.ValidationError | PagerDutyCreateIncident[];
}
export {};
