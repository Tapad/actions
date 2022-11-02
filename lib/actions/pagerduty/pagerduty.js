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
exports.PagerDutyAction = void 0;
const Hub = require("../../hub");
const pagerduty_client_1 = require("./pagerduty_client");
const pagerduty_form_1 = require("./pagerduty_form");
const winston = require("winston");
class PagerDutyAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "pagerduty";
        this.label = "PagerDuty";
        this.iconName = "pagerduty/pd_icon.png";
        this.description = `PagerDuty (${process.env.ACTION_HUB_LABEL})`;
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.requiredFields = [];
        this.params = [{
                name: "pagerduty_api_key",
                label: "PagerDuty API Key",
                required: true,
                description: `A PagerDuty API key used to authenticate with the PagerDuty REST API. For how to generate a key, please follow instructions at https://support.pagerduty.com/docs/generating-api-keys`,
                sensitive: true,
            }];
        this.usesStreaming = false;
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            function validationError(e) {
                console.warn(`Couldn't execute request: ${e.message}`);
                return new Hub.ActionResponse({ message: 'Validation error', success: false, validationErrors: [e] });
            }
            const form = pagerduty_form_1.PagerDutyForm.create(request.formParams);
            const apiKey = this.getApiKey(request);
            const resultSet = this.parseResultSet(request.attachment);
            if (request.scheduledPlan == null)
                return validationError({ field: '', message: 'PagerDuty action only available for schedule queries' });
            if (typeof apiKey !== "string")
                return validationError(apiKey);
            if (!Array.isArray(resultSet))
                return validationError(resultSet);
            const trimmedResultset = resultSet.slice(0, form.max_incidents);
            const incidents = form.createPagerDutyIncidents(trimmedResultset, request.scheduledPlan);
            if (!Array.isArray(incidents))
                return validationError(incidents);
            const client = new pagerduty_client_1.PagerDutyClient(apiKey);
            return client.createIncidents(incidents, [form.service_key], form.schedule_id);
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            const apiKey = this.getApiKey(request);
            if (typeof apiKey !== "string") {
                form.error = apiKey.message;
                return form;
            }
            const client = new pagerduty_client_1.PagerDutyClient(apiKey);
            // Call a remote endpoint to verify that the API key is correct
            // The 'form' method is invoked when the API key is entered in the Looker admin configuration
            const services = yield client.services();
            winston.info(`PagerDuty key validation OK. Found ${services.length} services.`);
            form.fields = pagerduty_form_1.PagerDutyForm.formFields;
            return form;
        });
    }
    getApiKey(request) {
        const apiKey = request.params['pagerduty_api_key'];
        if (apiKey == null)
            return {
                field: 'pagerduty_api_key',
                message: "API Key not configured for Looker. Please configured it in the admin section."
            };
        return apiKey;
    }
    parseResultSet(attachment) {
        if (attachment == null)
            return {
                field: 'service_key',
                message: "Please format data as JSON input, field not found 'attachment'"
            };
        if (attachment.mime !== 'application/json')
            return {
                field: 'service_key',
                message: `Please format data as JSON input. Expected MIME type 'application/json', got ${attachment.mime}`
            };
        if (attachment.dataJSON == null) {
            // Looker sent empty report
            return [];
        }
        else {
            if (Array.isArray(attachment.dataJSON))
                return attachment.dataJSON;
            else if (Array.isArray(attachment.dataJSON.data))
                return attachment.dataJSON.data;
            else
                return {
                    field: 'service_key',
                    message: 'JSON array or object expected'
                };
        }
    }
}
exports.PagerDutyAction = PagerDutyAction;
Hub.addAction(new PagerDutyAction());
