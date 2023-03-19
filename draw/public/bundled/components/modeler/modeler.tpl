<template id="process-modeler-component">
	<div class="process-modeler-component is-row is-spacing-gap-medium">
		<template v-if="!model && false">
			<div class="is-column is-spacing-medium is-width-max-xsmall is-width-min-xsmall is-color-background is-border-full">
				<ul class="is-menu is-variant-toolbar is-align-center">
					<li class="is-column"><button @click="startNewModel" class="is-button is-variant-primary is-size-small"><icon name="plus"/><span class="is-text">New process</span></button></li>
				</ul>
				<div v-for="process in processes" class="is-row is-spacing-medium is-align-cross-center">
					<span class="is-text">{{process.name}}</span>
					<span class="is-badge">v{{process.editableVersion}}</span>
					<button class="is-button is-variant-primary-outline is-size-small is-position-right" v-if="process.editableVersionId" @click="loadProcess(process.editableVersionId)">Edit</button>
				</div>
			</div>
		</template>
		<template v-else>
			<n-form class="is-variant-vertical" content-class="is-column is-spacing-medium is-width-max-xsmall is-width-min-xsmall is-color-background is-border-full process-modeler-form">
				<div class="is-column is-spacing-gap-medium">
					<ul class="is-menu is-variant-toolbar is-align-main-end">
						<li class="is-column" v-if="false"><button type="button" @click="model = null" :disabled="saving" class="is-button is-variant-secondary-outline is-size-xsmall"><icon name="undo"/><span class="is-text">Back</span></button></li>
						<li class="is-column"><button type="button" @click="exportAsPng" class="is-button is-variant-secondary-outline is-size-xsmall"><icon name="save"/><span class="is-text">Export as PNG</span></button></li>
						<li class="is-column"><button type="submit" @click="save" :disabled="saving" class="is-button is-variant-primary-outline is-size-xsmall"><icon name="save"/><span class="is-text">Save</span></button></li>
					</ul>
					<div class="is-column is-spacing-medium is-spacing-gap-small is-color-body">
						<div class="is-row is-align-cross-center">
							<ul class="is-menu is-variant-toolbar">
								<li class="is-column"><button @click="addState" class="is-button is-variant-primary is-size-xsmall"><icon name="plus"/><span class="is-text">State</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('initializer', 'Start', 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Initializer</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('finalizer', 'Exit', 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Finalizer</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('any', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Any</span></button></li>
								<li v-if="false" class="is-column"><button @click="addActionToCurrent('all', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">All</span></button></li>
							</ul>
							<div class="is-column is-position-right">
								<span class="is-content is-size-xxsmall is-decoration-upper">Control</span>
							</div>
						</div>
						<div class="is-row is-align-cross-center">
							<ul class="is-menu is-variant-toolbar">
								<li class="is-column"><button @click="addActionToCurrent('service', 'Service call', gridSize * 15, actionHeight, 'service')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Service</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('event', 'Event', gridSize * 15, actionHeight, 'event')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Event</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('signal', 'Signal', gridSize * 15, actionHeight, 'signal')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Signal</span></button></li>
							</ul>
							<div class="is-column is-position-right">
								<span class="is-content is-size-xxsmall is-decoration-upper">Steps</span>
							</div>
						</div>
					</div>
				</div>
				<div v-if="selected.type == 'action'" class="is-column is-spacing-gap-medium">
					<div class="is-row is-spacing-gap-medium">
						<n-form-text class="is-fill-normal" v-model="selected.target.name" label="Action name" @input="updatedActionName(selected.target)" after="A short name for this action"/>
						<n-form-text class="is-fill-half" v-if="selected.target.actionType == 'service' || selected.target.actionType == 'event' || selected.target.actionType == 'signal'" v-model="selected.target.reference" label="Reference" @input="draw" />
					</div>
					<n-form-text v-model="selected.target.code" label="Code" after="Use this to query the action programmatically. Change with caution as you might break references."/>
					<n-form-switch v-if="selected.target.actionType == 'any'" :value="selected.target.maxOccurs == 0" label="Require all" @input="updateAnyActionOccurs(selected.target, selected.target.maxOccurs == 0 ? null : 0); draw()"/>
					<n-form-text :value="selected.target.maxOccurs" v-if="selected.target.actionType == 'any' && selected.target.maxOccurs != 0" label="How many inputs must be resolved?" placeholder="1" @input="function(value) { updateAnyActionOccurs(selected.target, value); draw() }"/>
					<n-form-text v-if="selected.target.actionType == 'service' || selected.target.actionType == 'event' || selected.target.actionType == 'signal'" type="area" v-model="selected.target.summary" label="Action summary" @input="updatedActionSummary(selected.target)" after="A longer summary what this action should do"/>
					<n-form-text v-if="selected.target.actionType == 'service'" label="Condition" v-model="selected.target.condition" after="You can set an additional condition that must be true before this action is matched"/>
					<n-form-combo v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text v-if="selected.target.actionType == 'service'" v-model="selected.target.serviceId" label="Service id that is executed"/>
					<n-form-switch v-if="selected.target.actionType == 'service' && !selected.target.automatic" v-model="selected.target.reprocessable" label="Allow reprocessing" @input="draw" after="Do you want to be able to reprocess this service if it fails?"/>
					<n-form-switch v-if="selected.target.actionType == 'service'" v-model="selected.target.automatic" label="Run the service" @input="draw" after="By default we wait for the service to be run. When checked, we actually run the service. Note that all automatic actions are always reprocessable"/>
					<n-form-switch v-if="selected.target.actionType == 'signal'" v-model="selected.target.automatic" label="Send signal" after="By default we wait for the signal to occur. When checked, we actually send the signal." @input="draw"/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.automatic">
						<n-form-text v-model="selected.target.delay" label="Delay" :disabled="selected.target.schedule" after="You can run this after a certain delay (e.g. 24 hours)" @input="draw"/>
						<n-form-text v-model="selected.target.schedule" label="Schedule" :disabled="selected.target.delay" after="You can run this according to a certain schedule" @input="draw"/>
						<n-form-text v-model="selected.target.queue" label="Task queue" after="You can set a specific queue for this automated task" :placeholder="model.queue ? model.queue : 'anonymous'"/>
					</div>
					<div v-if="selected.target.automatic" class="is-column is-spacing-gap-medium">
						<div v-if="selected.target.binding" class="is-column is-spacing-gap-medium">
							<div v-for="(input, inputIndex) in selected.target.binding" class="is-column has-button-close is-spacing-medium is-color-body">
								<n-form-combo v-model="input.key" label="Key" :filter="getServiceInputs.bind($self, selected.target)" :formatter="function(x) { return x.name }" :extracter="function(x) { return x.name }"/>
								<n-form-text v-model="input.value" label="Value"/>
								<button @click="selected.target.binding.splice(inputIndex, 1)" class="is-button is-variant-close is-size-small"><icon name="times"/></button>
							</div>
						</div>
						<div class="is-row is-align-end">
							<button @click="addInputMapping(selected.target)" class="is-button is-variant-primary-outline is-size-small"><icon name="plus"/><span class="is-text">Input Mapping</span></button>
						</div>
					</div>
					<n-form-switch v-if="selected.target.actionType == 'service' && false" v-model="selected.target.strict" @input="draw" label="Strict" after="By default if we do not find a matching process instance for this service, we will simply let it execute. By setting it to strict, further execution is blocked"/>
					<n-form-switch v-else-if="selected.target.actionType == 'service'" v-model="selected.target.lax" @input="draw" label="Lax" after="By default if we do not find a matching process instance for this service, we will block execution. If you set it to lax, we will allow execution without a matching instance. Primarily relevant for reusable utility services."/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.actionType == 'service'">
						<n-form-text v-model="selected.target.maxOccurs" label="Max occurs" placeholder="0" after="How many times should the action at most be executed? Default is 0 which means unlimited because execution is typically blocked by flow rather than amount." />
					</div>
					<div v-if="selected.target.actionType == 'service' && !selected.target.automatic" class="is-column is-spacing-gap-medium">
						<n-form-combo v-model="selected.target.identificationType" :placeholder="model.defaultIdentificationType ? model.defaultIdentificationType : 'correlationId'" :items="['global', 'correlationId', 'userId', 'sessionId', 'deviceId', 'custom']" label="Identification type" after="How do you want to identify process instances?"/>
						<p class="is-p is-size-small" v-if="selected.target.identificationType == 'correlationId'">A correlation id is limited to a single thread execution, it can be used to follow up on very short processes</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'sessionId'">A session id can be passed in through HTTP requests to link together multiple requests over time. Note that browser-based session ids can be subject to fixation attacks through XSS, they should not be used in critical processes.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'userId'">The user id can be useful though it is a very static identifier.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'deviceId'">Device id can only be used when dealing with browser-based processes.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'custom'">Custom identifiers allow you to extract dynamic values to match, this requires more configuration though as each action must be related back to a custom identifier.</p>
						<p class="is-p is-size-small" v-else>When set to globally, only one instance of a process can be active at a time</p>
					</div>
					<div v-if="selected.target.actionType == 'service'" class="is-column is-spacing-gap-medium">
						<h4 class="is-h4">Value capturing</h4>
						<p class="is-p is-size-small">You can capture values from the service pipeline to either identify the process instance or enrich it with metadata</p>
						<div v-for="capture in getCapturesFor(selected.target.id)" class="is-column is-color-body is-spacing-medium has-button-close">
							<n-form-text v-model="capture.name" label="Name"/>
							<n-form-text v-model="capture.capture" label="Capture" after="The query to run on the pipeline to capture the value" :timeout="300" @input="function(value) { var phase = getCapturePhase(value); if (phase) capture.phase = phase }"/>
							<n-form-combo v-if="capture.capture && !getCapturePhase(capture.capture)" v-model="capture.phase" label="Phase" after="The phase in which it should be captured" :items="['input', 'output']" placeholder="output"/>
							<n-form-switch v-if="!capture.transient" v-model="capture.identifier" label="Identifier" after="Whether or not this field can be counted as an identifying field for this process instance" />
							<n-form-switch v-if="!capture.identifier" v-model="capture.transient" label="Transient" after="Transient captures are not stored but can be used to enrich things like description"/>
							<button @click="removeCapture(capture)" class="is-button is-variant-close is-size-small"><icon name="times"/></button>
						</div>
						<n-form-text v-model="selected.target.description" v-if="getCapturesFor(selected.target.id).length > 0" label="Dynamic description" after="You can use variables to create a variable description for this action instance"/>
					</div>
					<div class="is-row is-align-end is-spacing-medium">
						<button class="is-button is-size-xsmall is-variant-primary-outline" type="button" @click="newCapture(selected.target.id)"><icon name="plus"/><span class="is-text">Capture</span></button>
					</div>
					<n-form-text type="area" v-model="selected.target.comment" label="Comment" after="Additional comments you want to add"/>
				</div>
				<div v-else-if="selected.type == 'actionRelation'" class="is-column is-spacing-gap-medium">
					<n-form-combo v-model="selected.target.relationType" label="Relation type" :items="['flow', 'limit']" @input="draw"/>
					<n-form-text v-model="selected.target.condition" label="Condition" after="You can have this relation only count if a certain condition results to true" v-if="selected.target.relationType == 'flow'" @input="draw" :timeout="600"/>
					<n-form-switch v-model="selected.target.styling.showCondition" label="Always show condition" after="By default the condition is only shown on hover. Toggle this to always show it." v-if="selected.target.condition && selected.target.relationType == 'flow'" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'stateRelation'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.condition" label="Condition" after="You can have this relation only count if a certain condition results to true" @input="draw" :timeout="600"/>
					<n-form-switch v-model="selected.target.styling.showCondition" label="Always show condition" after="By default the condition is only shown on hover. Toggle this to always show it." v-if="selected.target.condition" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'state'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.name" label="State name" @input="draw" after="A short name for this state"/>
					<n-form-text v-model="selected.target.code" label="Code" after="Use this to query the state programmatically. Change with caution as you might break references."/>
					<n-form-combo v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-switch v-if="selected.target.initial" v-model="selected.target.initial" label="Initial state" after="A new process instance can only be created in an initial state. There must be at least one in a process."/>
					<n-form-text type="area" v-model="selected.target.comment" label="Comment" after="Additional comments you want to add"/>
				</div>
				<div v-else class="is-column is-spacing-gap-medium">
					<n-form-text v-model="model.name" label="Process name"/>
					<n-form-text v-model="model.code" label="Code" after="Use this to query the process programmatically. Change with caution as you might break references."/>
					<n-form-text v-model="model.queue" label="Process queue" after="By default each process instance has its own anonymous queue, you can however set a shared queue" placeholder="anonymous"/>
					<n-form-combo v-model="model.styling.theme" label="Theme" :items="themes" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text type="area" v-model="model.comment" label="Comment" after="Additional comments you want to add"/>
					<div class="is-column is-spacing-gap-medium">
						<n-form-combo v-model="model.defaultIdentificationType" placeholder="global" :items="['global', 'correlationId', 'userId', 'sessionId', 'deviceId', 'custom']" label="Default identification type" after="How do you want to identify process instances by default? This can be overriden per service action."/>
						<p class="is-p is-size-small" v-if="model.defaultIdentificationType == 'correlationId'">A correlation id is limited to a single thread execution, it can be used to follow up on very short processes</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'sessionId'">A session id can be passed in through HTTP requests to link together multiple requests over time. Note that browser-based session ids can be subject to fixation attacks through XSS, they should not be used in critical processes.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'userId'">The user id can be useful though it is a very static identifier.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'deviceId'">Device id can only be used when dealing with browser-based processes.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'custom'">Custom identifiers allow you to extract dynamic values to match, this requires more configuration though as each action must be related back to a custom identifier.</p>
						<p class="is-p is-size-small" v-else>When set to globally, only one instance of a process can be active at a time</p>
					</div>
				</div>
			</n-form>
			<div class="is-column is-overflow-auto">
				<svg ref="svg">
					<defs>
						<symbol id="icon-signal" viewBox="0 0 256 256">
							<g style="stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
								<path d="M 80.561 11.626 H 9.439 C 4.234 11.626 0 15.86 0 21.065 v 47.87 c 0 5.204 4.234 9.438 9.439 9.438 h 71.122 c 5.205 0 9.439 -4.234 9.439 -9.438 v -47.87 C 90 15.86 85.766 11.626 80.561 11.626 z M 80.561 16.571 c 0.189 0 0.37 0.033 0.553 0.056 L 45 49.759 L 8.886 16.627 c 0.183 -0.023 0.364 -0.056 0.553 -0.056 H 80.561 z M 85.055 68.935 c 0 2.477 -2.016 4.493 -4.494 4.493 H 9.439 c -2.478 0 -4.494 -2.016 -4.494 -4.493 v -47.87 c 0 -0.411 0.073 -0.802 0.177 -1.18 L 32.498 45 l -17.25 15.825 c -1.006 0.922 -1.074 2.487 -0.151 3.493 c 0.488 0.531 1.154 0.801 1.823 0.801 c 0.597 0 1.196 -0.215 1.671 -0.651 l 17.564 -16.113 l 7.173 6.58 c 0.473 0.434 1.072 0.651 1.671 0.651 s 1.199 -0.217 1.672 -0.651 l 7.173 -6.58 l 17.564 16.113 c 0.475 0.436 1.074 0.651 1.671 0.651 c 0.669 0 1.336 -0.269 1.823 -0.801 c 0.923 -1.006 0.856 -2.571 -0.15 -3.493 L 57.502 45 l 27.376 -25.114 c 0.104 0.378 0.177 0.769 0.177 1.18 V 68.935 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
							</g>
						</symbol>
						<symbol id="icon-service" viewBox="0 0 256 256">
							<g style="stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
								<path d="M 45 43.722 c -0.449 0 -0.897 -0.101 -1.311 -0.302 L 4.878 24.56 c -1.033 -0.502 -1.689 -1.55 -1.689 -2.698 s 0.656 -2.196 1.688 -2.698 L 43.688 0.302 c 0.828 -0.402 1.795 -0.402 2.623 0 l 38.811 18.861 c 1.033 0.502 1.688 1.55 1.688 2.698 s -0.655 2.196 -1.688 2.698 L 46.312 43.42 C 45.897 43.622 45.449 43.722 45 43.722 z M 13.053 21.861 L 45 37.387 l 31.947 -15.525 L 45 6.335 L 13.053 21.861 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
								<path d="M 45 90 c -0.449 0 -0.897 -0.101 -1.312 -0.302 L 4.878 70.837 c -1.033 -0.502 -1.688 -1.55 -1.688 -2.698 V 21.861 c 0 -1.034 0.532 -1.995 1.408 -2.543 c 0.876 -0.549 1.973 -0.606 2.903 -0.155 L 45 37.387 l 37.499 -18.224 c 0.929 -0.452 2.026 -0.394 2.903 0.155 c 0.876 0.548 1.408 1.509 1.408 2.543 v 46.277 c 0 1.148 -0.655 2.196 -1.688 2.698 L 46.312 89.698 C 45.897 89.899 45.449 90 45 90 z M 9.189 66.261 L 45 83.664 l 35.811 -17.403 V 26.655 L 46.312 43.42 c -0.828 0.402 -1.795 0.402 -2.623 0 l -34.5 -16.766 V 66.261 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
								<path d="M 45 90 c -1.657 0 -3 -1.343 -3 -3 V 40.722 c 0 -1.657 1.343 -3 3 -3 c 1.657 0 3 1.343 3 3 V 87 C 48 88.657 46.657 90 45 90 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
							</g>
						</symbol>
						<symbol id="icon-event" viewBox="0 0 256 256">
							<g style="stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
								<path d="M 45 70.454 c -2.761 0 -5 -2.238 -5 -5 V 24.545 c 0 -2.761 2.239 -5 5 -5 c 2.762 0 5 2.239 5 5 v 40.909 C 50 68.216 47.762 70.454 45 70.454 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
								<path d="M 65.454 50 H 24.545 c -2.761 0 -5 -2.238 -5 -5 c 0 -2.761 2.239 -5 5 -5 h 40.909 c 2.762 0 5 2.239 5 5 C 70.454 47.762 68.216 50 65.454 50 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
								<path d="M 71.932 90 H 18.068 C 8.105 90 0 81.895 0 71.932 V 18.068 C 0 8.105 8.105 0 18.068 0 h 53.864 C 81.895 0 90 8.105 90 18.068 v 53.864 C 90 81.895 81.895 90 71.932 90 z M 18.068 10 C 13.619 10 10 13.619 10 18.068 v 53.864 C 10 76.381 13.619 80 18.068 80 h 53.864 C 76.381 80 80 76.381 80 71.932 V 18.068 C 80 13.619 76.381 10 71.932 10 H 18.068 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
							</g>
						</symbol>
					</defs>
				</svg>
			</div>
			<div class="is-column is-width-max-xsmall is-width-min-xsmall process-modeler-spacer"></div>
		</template>
	</div>
</template>