import {
	Allure,
	AllureRuntime,
	AllureStep,
	AllureTest,
	AttachmentOptions,
	ExecutableItemWrapper,
	LabelName,
	LinkType,
	Severity,
	Status,
	StepInterface,
	isPromise} from 'allure-js-commons';

import StepWrapper from './step-wrapper';
import type AllureReporter from './allure-reporter';

/**
 * Supported content types for Allure attachments.
 *
 * _This enum was copied and extended from allure-js-commons_
 */
export enum ContentType {
	// Allure-js-commons ContentTypes:
	TEXT = 'text/plain',
	XML = 'application/xml',
	CSV = 'text/csv',
	TSV = 'text/tab-separated-values',
	CSS = 'text/css',
	URI = 'text/uri-list',
	SVG = 'image/svg+xml',
	PNG = 'image/png',
	JSON = 'application/json',
	WEBM = 'video/webm',
	JPEG = 'image/jpeg',
	// Custom extensions:
	HTML = 'text/html'
}

export type Labels = {
	name: string,
	value: string,
	index?: number
}

export default class JestAllureInterface extends Allure {
	jiraUrl: string;
	tmsUrl = '';
	labels: Labels[] = [];

	constructor(
		private readonly reporter: AllureReporter,
		runtime: AllureRuntime,
		jiraUrl?: string
	) {
		super(runtime);
		this.jiraUrl = jiraUrl ?? '';
	}

	get currentExecutable(): AllureStep | AllureTest | ExecutableItemWrapper {
		const executable: AllureStep | AllureTest | ExecutableItemWrapper | null = 
		this.reporter.currentStep ??
        this.reporter.currentTest ??
		this.reporter.currentExecutable;

		if (!executable) {
			throw new Error('No executable!');
		}

		return executable;
	}

	set currentExecutable(executable: AllureStep | AllureTest | ExecutableItemWrapper) {
		this.reporter.currentExecutable = executable;
	}
	
	label(name: string, value: string, index?: number) {
		this.currentTest ? this.currentTest.addLabel(name, value) : this.labels.push({name: name, value: value, index});
		this.labels ? this.reporter.labels.push(...this.labels) : null;
	}

	severity(severity: Severity, index?: number) {
		this.label(LabelName.SEVERITY, severity, index);
	}

	tag(tag: string, index?: number) {
		this.currentTest.addLabel(LabelName.TAG, tag);
	}

	owner(owner: string, index?: number) {
		this.label(LabelName.OWNER, owner, index);
	}

	lead(lead: string, index?: number) {
		this.label(LabelName.LEAD, lead, index);
	}

	epic(epic: string, index?: number) {
		this.label(LabelName.EPIC, epic, index);
	}

	feature(feature: string, index?: number) {
		this.label(LabelName.FEATURE, feature, index);
	}

	story(story: string, index?: number) {
		this.label(LabelName.STORY, story, index);
	}

	issue(name: string) {
		this.link(this.jiraUrl, name, LinkType.ISSUE);
	}

	tms(name: string) {
		this.link(this.tmsUrl, name, LinkType.TMS);
	}

	startStep(name: string): StepWrapper {
		const allureStep: AllureStep = this.currentExecutable.startStep(name);
		this.reporter.pushStep(allureStep);
		return new StepWrapper(this.reporter, allureStep);
	}
	
	// @ts-expect-error (ts(1064))
	async step<T>(name: string, body: (step: StepInterface) => T): T {
		const wrappedStep = this.startStep(name);
		let result;
		try {
			result = wrappedStep.run(body);
		} catch (error: unknown) {
			wrappedStep.endStep();
			throw error;
		}

		if (isPromise(result)) {
			const promise = result as T;

			try {
				const resolved = await promise;
				wrappedStep.endStep();
				return resolved;
			} catch (error: unknown) {
				wrappedStep.endStep();
				throw error;
			}
		}

		wrappedStep.endStep();
		return result;
	}

	logStep(
		name: string,
		status: Status,
		attachments?: Array<{name: string; content: Buffer | string; type: ContentType | string | AttachmentOptions}>
	): void {
		const step = this.startStep(name);

		step.status = status;

		if (attachments) {
			for (const a of attachments) {
				this.attachment(a.name, a.content, a.type);
			}
		}

		step.endStep();
	}

	description(markdown: string) {
		const {currentTest} = this.reporter;

		if (!currentTest) {
			throw new Error('Expected a test to be executing before adding a description.');
		}

		currentTest.description = markdown;
	}

	descriptionHtml(html: string) {
		const {currentTest} = this.reporter;

		if (!currentTest) {
			throw new Error('Expected a test to be executing before adding an HTML description.');
		}

		currentTest.descriptionHtml = html;
	}

	attachment(
		name: string,
		content: Buffer | string,
		type: ContentType | string | AttachmentOptions
	): void {
		const file = this.reporter.writeAttachment(content, type);
		this.currentExecutable.addAttachment(name, type, file);
	}

	testAttachment(
		name: string,
		content: Buffer | string,
		type: ContentType | string | AttachmentOptions
	): void {
		const file = this.reporter.writeAttachment(content, type);
		this.currentTest.addAttachment(name, type, file);
	}

	get currentTest(): AllureTest {
		// @ts-expect-error (2322)
		return this.reporter.currentTest;
	}

	allureId(id: string, index?: number): void {
		this.label(LabelName.AS_ID, id, index);
	}
}
