import * as Hub from '../../hub'
import { PagerDutyCreateIncident, PagerDutyEventAction } from './pagerduty_create_incident'
import * as moment from 'moment'
import { ParamMap } from '../../hub'
import * as Mustache from 'mustache'

enum FormFields {
    ServiceKeyKey = 'service_key',
    DeDeuplicationIdColumnKey = 'deduplication_id_column',
    ScheduleIdKey = 'schdeule_id',
    AutoResolveKey = 'auto_resolution_boolean',
    MaxIncidentsKey = 'max_incidents',
    Summary = 'summary',
    Severity = 'severity',
    Message = 'message'
}


enum Severity {
    Critical = 'critical',
    Error = 'error',
    Warning = 'warning',
    Info = 'info',
}

interface IPagerDutyForm {
    [FormFields.ServiceKeyKey]: string,
    [FormFields.DeDeuplicationIdColumnKey]: string,
    [FormFields.ScheduleIdKey]: string,
    [FormFields.AutoResolveKey]: boolean,
    [FormFields.MaxIncidentsKey]: number,
    [FormFields.Summary]: string,
    [FormFields.Message]: string,
    [FormFields.Severity]: Severity,
}

export class PagerDutyForm {
    static formFields: Hub.ActionFormField[] = [
        {
            label: 'Service key',
            type: 'string',
            name: FormFields.ServiceKeyKey,
            description: 'An Events API v2 integration key',
            required: true
        }, {
            label: 'De-duplication id column',
            name: FormFields.DeDeuplicationIdColumnKey,
            description: 'Column in the result set that uniquely identifies an alert',
            type: 'string',
            required: true
        }, {
            label: 'Unique name or ID of this schedule',
            name: FormFields.ScheduleIdKey,
            description: 'A value that uniquely identifies this schedule. Used to ensure schedules do not incorrectly resolve alerts generated by other schedules.',
            type: 'string',
            required: true
        }, {
            label: 'Enable automatic resolution',
            name: FormFields.AutoResolveKey,
            description: 'Automatically resolves incidents',
            type: 'string',
            default: 'true',
            required: true
        },
        {
            label: 'Maximum number of incidents',
            name: FormFields.MaxIncidentsKey,
            description: 'Maximum number of incidents to create based on result set',
            type: 'string',
            default: '10',
            required: true
        },
        {
            label: 'Summary',
            name: FormFields.Summary,
            description: 'Incident summary',
            type: 'string',
            required: true
        },
        {
            label: 'Severity',
            name: FormFields.Severity,
            description: 'Severity',
            type: 'select',
            default: "Critical",
            options: Object.keys(Severity).map(k => ({ name: k, label: k })),
            required: true
        },
        {
            label: 'Message',
            name: FormFields.Message,
            description: 'Message',
            type: 'textarea',
            required: true
        },

    ]

    static jsonToInterface(json: ParamMap): IPagerDutyForm {
        return {
            [FormFields.ServiceKeyKey]: json[FormFields.ServiceKeyKey]!,
            [FormFields.DeDeuplicationIdColumnKey]: json[FormFields.DeDeuplicationIdColumnKey]!,
            [FormFields.ScheduleIdKey]: json[FormFields.ScheduleIdKey]!,
            [FormFields.AutoResolveKey]: Boolean(json[FormFields.AutoResolveKey]),
            [FormFields.MaxIncidentsKey]: Number(json[FormFields.MaxIncidentsKey]),
            [FormFields.Summary]: json[FormFields.Summary]!,
            [FormFields.Severity]: Severity[json[FormFields.Severity]! as keyof typeof Severity],
            [FormFields.Message]: json[FormFields.Message]!
        }
    }

    static create(json: ParamMap): PagerDutyForm {
        const inter = this.jsonToInterface(json)

        return new PagerDutyForm(
            inter[FormFields.ServiceKeyKey],
            inter[FormFields.DeDeuplicationIdColumnKey],
            inter[FormFields.ScheduleIdKey],
            inter[FormFields.AutoResolveKey],
            inter[FormFields.MaxIncidentsKey],
            inter[FormFields.Summary],
            inter[FormFields.Severity],
            inter[FormFields.Message]
        )
    }

    constructor(
        public service_key: string,
        public deduplication_id_column: string,
        public schedule_id: string,
        public auto_resolution_boolean: boolean,
        public max_incidents: number,
        public summary: string,
        public severity: Severity,
        public message: string) { }

    public createPagerDutyIncidents(resultSet: any[], plan: Hub.ActionScheduledPlan): Hub.ValidationError | PagerDutyCreateIncident[] {
        const details = {
            title: plan.title!,
            type: plan.type!,
            model: plan.query!.model,
            url: plan.query!.share_url!,
        }

        return resultSet.reduce<Hub.ValidationError | PagerDutyCreateIncident[]>((acc, el) => {
            if (!Array.isArray(acc)) return acc

            if (el[this.deduplication_id_column] == null)
                return {
                    field: FormFields.DeDeuplicationIdColumnKey,
                    message: `Couldn't find column ${this.deduplication_id_column} in result set`
                }

            const templatedMessage = Mustache.render(this.message, el)
            const templatedSummary = Mustache.render(this.summary, el)

            const incident: PagerDutyCreateIncident = {
                routing_key: this.service_key,
                event_action: PagerDutyEventAction.Trigger,
                dedup_key: el[this.deduplication_id_column] as string,
                payload: {
                    summary: templatedSummary,
                    severity: this.severity,
                    source: plan.query!.url!,
                    timestamp: moment().format(),
                    custom_details: {
                        managed_by_looker: true,
                        auto_resolve: this.auto_resolution_boolean,
                        schedule_id: this.schedule_id,
                        ...details,
                        ...el,
                        message: templatedMessage
                    }
                },
                client: "Looker",
                client_url: details.url,
                links: [{href: details.url, text: 'Scheduled query'}],
            }

            return acc.concat([incident])
        }, [] as PagerDutyCreateIncident[])
    }
}