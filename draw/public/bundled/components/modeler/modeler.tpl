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
						<li class="is-column"><n-form-combo class="is-size-small mouse-mode" v-model="mouseMode" :items="['mouse', 'trackpad']" placeholder="mouse"/></li>
						<li class="is-column"><button type="button" @click="exportAsPng" class="is-button is-variant-secondary-outline is-size-xsmall"><icon name="save"/><span class="is-text">Export as PNG</span></button></li>
						<li class="is-column"><button type="submit" @click="save" :disabled="saving || !editable" class="is-button is-variant-primary-outline is-size-xsmall"><icon name="save"/><span class="is-text">Save</span></button></li>
					</ul>
					<div class="is-column is-spacing-medium is-spacing-gap-small is-color-body" v-if="editable">
						<div class="is-row is-align-cross-center">
							<ul class="is-menu is-variant-toolbar">
								<li class="is-column"><button @click="addState" class="is-button is-variant-primary is-size-xsmall"><icon name="plus"/><span class="is-text">State</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('initializer', 'Start', 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Initializer</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('finalizer', 'Exit', 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Finalizer</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('any', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Any</span></button></li>
								<li v-if="false" class="is-column"><button @click="addActionToCurrent('all', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">All</span></button></li>
							</ul>
							<div class="is-column is-position-right" v-if="false">
								<span class="is-content is-size-xxsmall is-decoration-upper">Control</span>
							</div>
						</div>
						<div class="is-row is-align-cross-center">
							<ul class="is-menu is-variant-toolbar">
								<li class="is-column"><button @click="addActionToCurrent('service', 'Service call', 150, actionHeight, 'service')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Service</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('human', 'Human task', 150, actionHeight, 'human')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Human</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('event', 'Event', 150, actionHeight, 'event')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Event</span></button></li>
								<li class="is-column"><button @click="addActionToCurrent('signal', 'Signal', 150, actionHeight, 'signal')" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Signal</span></button></li>
							</ul>
							<div class="is-column is-position-right" v-if="false">
								<span class="is-content is-size-xxsmall is-decoration-upper">Steps</span>
							</div>
						</div>
					</div>
				</div>
				<div v-if="selected.type == 'action'" class="is-column is-spacing-gap-medium">
					<div class="is-row is-spacing-gap-medium">
						<n-form-text :edit="editable" class="is-fill-normal" v-model="selected.target.name" label="Action name" @input="updatedActionName(selected.target)" after="A short name for this action"/>
						<n-form-text :edit="editable" class="is-fill-half" v-if="selected.target.actionType == 'service' || selected.target.actionType == 'event' || selected.target.actionType == 'signal'" v-model="selected.target.reference" label="Reference" @input="draw" />
					</div>
					<n-form-text :edit="editable" v-model="selected.target.code" label="Code" after="Use this to query the action programmatically. Change with caution as you might break references."/>
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'any'" :value="selected.target.maxOccurs == 0" label="Require all" @input="updateAnyActionOccurs(selected.target, selected.target.maxOccurs == 0 ? null : 0); draw()"/>
					<n-form-text :edit="editable" :value="selected.target.maxOccurs" v-if="selected.target.actionType == 'any' && selected.target.maxOccurs != 0" label="How many inputs must be resolved?" placeholder="1" @input="function(value) { updateAnyActionOccurs(selected.target, value); draw() }"/>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service' || selected.target.actionType == 'event' || selected.target.actionType == 'signal' || selected.target.actionType == 'human'" type="area" v-model="selected.target.summary" label="Action summary" @input="updatedActionSummary(selected.target)" after="A longer summary what this action should do"/>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service' || selected.target.actionType == 'signal'" label="State Condition" v-model="selected.target.stateCondition" after="You can use both the input of the action and the process state to conclude whether this is allowed to run or not."/>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service' || selected.target.actionType == 'signal'" label="Capture Condition" v-model="selected.target.condition" after="You can set an additional condition that must be true before this action is matched. As a rule: the more generic the service you are capturing, the more specific your condition should be."/>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service'" label="Error Condition" v-model="selected.target.errorCondition" after="Even if the service concludes successfully we may want to flag it as ERROR or FAILED (depending on the auto fail flag)"/>
					<n-form-combo :key="selected.target.id + '-checkPermissionId'" :edit="editable" v-if="selected.target.actionType == 'service' && !selected.target.automatic" label="Permission checker" v-model="selected.target.checkPermissionId" after="Run an additional security check to see if this is allowed at this point. Use with caution, it is not meant to replace state checks"
						:timeout="600"
						:filter="getCheckPermissions"
						:formatter="function(x) { return x.title + (x.description ? ' (' + x.description + ')' : '') }"
						:extracter="function(x) { return x.id }"/>
					<div v-if="selected.target.actionType == 'signal'">
						<n-form-text :edit="editable" v-model="selected.target.signalId" label="Signal Id" after="Make sure this name is globally unique to avoid conflicting signals. Consider adding a namespace"/>
						<n-form-text v-if="selected.target.automatic" :edit="editable" v-model="selected.target.dataTypeId" label="Signal data type id" after="The data type of the data being sent"/>
					</div>
					<div v-else-if="selected.target.actionType == 'human'">
						<n-form-text :edit="editable" v-model="selected.target.dataTypeId" label="Human task data type id" after="The data type of the data accompanying the human task (if any)"/>
						<n-form-text :edit="editable" v-model="selected.target.contextIdQuery" label="Context id query" after="Set a fixed value or use '=' syntax to retrieve a value from the process data to use as context id. This may be useful for security purposes."/>
					</div>
					<div v-else-if="selected.target.actionType == 'event' && false">
						<n-form-text :edit="editable" v-model="selected.target.eventId" label="Event Id" after="The id of an event is has the following format: <eventCategory>:<eventName>"/>
					</div>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service'" label="Force Condition" v-model="selected.target.forceCondition" after="If this evaluates to true, the action is forced to run, even if it is not allowed due to the state of the process instance"/>
					<n-form-combo :edit="editable" v-if="selected.target.forceCondition" label="Force strategy" v-model="selected.target.forceStrategy"
						:items="[{name: 'actionOnly', title: 'Run the action without updating the state'}, {name: 'actionAndState', title: 'Always start a new state instance'}]"
						:formatter="function(x) { return x.title }"
						:extracter="function(x) { return x.name }"/>
					<n-form-combo :edit="editable" v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text :edit="editable" v-if="selected.target.actionType == 'service'" v-model="selected.target.serviceId" label="Service id that is executed"/>
					<n-form-switch :edit="editable" v-model="selected.target.manual" label="Allow manual triggering" @input="draw" after="Do you want to be able to trigger this manually?"/>
					<n-form-text :edit="editable" v-model="selected.target.manualName" v-if="selected.target.manual" label="Label for manual action" :placeholder="selected.target.name" />
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'service' && !selected.target.automatic" v-model="selected.target.reprocessable" label="Allow reprocessing" @input="draw" after="Do you want to be able to reprocess this service if it fails?"/>
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'service'" v-model="selected.target.automatic" label="Run the service" @input="draw" after="By default we wait for the service to be run. When checked, we actually run the service. Note that all automatic actions are always reprocessable"/>
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'signal'" v-model="selected.target.automatic" label="Send signal" after="By default we wait for the signal to occur. When checked, we actually send the signal." @input="draw"/>
					<n-form-switch :edit="editable" v-if="['signal', 'service', 'human', 'finalizer'].indexOf(selected.target.actionType) >= 0 && selected.target.automatic" v-model="selected.target.synchronous" label="Execute synchronously"  @input="draw" after="The action can be run asynchronously or synchronously depending on this setting"/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.automatic && !selected.target.synchronous">
						<n-form-text :edit="editable" v-model="selected.target.delay" label="Delay" :disabled="selected.target.schedule" after="You can run this after a certain delay (e.g. 24 hours)" @input="draw"/>
						<n-form-text :edit="editable" v-model="selected.target.schedule" label="Schedule" :disabled="selected.target.delay" after="You can run this according to a certain schedule" @input="draw"/>
						<n-form-text :edit="editable" v-model="selected.target.queue" label="Task queue" after="You can set a specific queue for this automated task" :placeholder="model.queue ? model.queue : 'anonymous'"/>
					</div>
					<div class="is-column is-spacing-gap-medium">
						<div v-if="selected.target.binding" class="is-column is-spacing-gap-medium">
							<div v-for="(input, inputIndex) in selected.target.binding" class="is-column has-button-close is-spacing-medium is-color-body">
								<n-form-combo :edit="editable" v-model="input.key" label="Key" :filter="getServiceInputs.bind($self, selected.target)" :formatter="function(x) { return x.path }" :extracter="function(x) { return x.path }" v-if="selected.target.actionType == 'service'"/>
								<n-form-combo :edit="editable" v-model="input.key" label="Key" :filter="getTypeDefinition.bind($self, selected.target)" :formatter="function(x) { return x.path }" :extracter="function(x) { return x.path }" v-else-if="selected.target.actionType == 'human' || selected.target.actionType == 'signal'"/>
								<n-form-text :edit="editable" v-model="input.key" label="Key" v-else/>
								<n-form-text :edit="editable" v-model="input.value" label="Value"/>
								<button v-if="editable" @click="selected.target.binding.splice(inputIndex, 1)" class="is-button is-variant-close is-size-small"><icon name="times"/></button>
							</div>
						</div>
						<div class="is-row is-align-end">
							<button v-if="editable" @click="addInputMapping(selected.target)" class="is-button is-variant-primary-outline is-size-small"><icon name="plus"/><span class="is-text">Input Mapping</span></button>
						</div>
					</div>
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'service'" v-model="selected.target.autoFail" @input="draw" label="Auto fail" after="In some cases errors are expected and already handled (e.g. by reporting them to a third party). Set this if errors should immediately go to failed state."/>
					<n-form-switch :edit="editable" v-if="selected.target.actionType == 'service' && false" v-model="selected.target.strict" @input="draw" label="Strict" after="By default if we do not find a matching process instance for this service, we will simply let it execute. By setting it to strict, further execution is blocked"/>
					<n-form-switch :edit="editable" v-else-if="selected.target.actionType == 'service'" v-model="selected.target.lax" @input="draw" label="Lax" after="By default if we do not find a matching process instance for this service, we will block execution. If you set it to lax, we will allow execution without a matching instance. Primarily relevant for reusable utility services."/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.actionType == 'service'">
						<n-form-text :edit="editable" v-model="selected.target.maxOccurs" label="Max occurs" placeholder="0" after="How many times should the action at most be executed? Default is 0 which means unlimited because execution is typically blocked by flow rather than amount." />
					</div>
					<div v-if="['service', 'signal'].indexOf(selected.target.actionType) >= 0 && !selected.target.automatic" class="is-column is-spacing-gap-medium">
						<n-form-combo :edit="editable" v-model="selected.target.identificationType" :placeholder="model.defaultIdentificationType ? model.defaultIdentificationType : 'correlationId'" :items="['global', 'correlationId', 'userId', 'sessionId', 'deviceId', 'custom']" label="Identification type" after="How do you want to identify process instances?"/>
						<p class="is-p is-size-small" v-if="selected.target.identificationType == 'correlationId'">A correlation id is limited to a single thread execution, it can be used to follow up on very short processes</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'sessionId'">A session id can be passed in through HTTP requests to link together multiple requests over time. Note that browser-based session ids can be subject to fixation attacks through XSS, they should not be used in critical processes.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'userId'">The user id can be useful though it is a very static identifier.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'deviceId'">Device id can only be used when dealing with browser-based processes.</p>
						<p class="is-p is-size-small" v-else-if="selected.target.identificationType == 'custom'">Custom identifiers allow you to extract dynamic values to match, this requires more configuration though as each action must be related back to a custom identifier.</p>
						<p class="is-p is-size-small" v-else>When set to globally, only one instance of a process can be active at a time</p>
					</div>
					<div v-if="selected.target.actionType == 'service' || selected.target.actionType == 'signal' || selected.target.actionType == 'human'" class="is-column is-spacing-gap-medium">
						<h4 class="is-h4">Value capturing</h4>
						<n-form-text :edit="editable" v-model="selected.target.stateSuccessVariable" label="Variable name to capture success or failure of state (boolean)" />
						<n-form-switch :edit="editable" v-model="selected.target.linkToUser" v-if="selected.target.actionType == 'service'" label="Link to user" @input="draw" after="If enabled, the user details (userId, deviceId, sessionId) for this process will be updated, allowing for identification and/or permission checking on these variables."/>
						<p v-if="selected.target.actionType == 'service'" class="is-p is-size-small">You can capture values from the service pipeline to either identify the process instance or enrich it with metadata</p>
						<p v-else-if="selected.target.actionType == 'signal'" class="is-p is-size-small">You can capture values from the signal data to either identify the process instance or enrich it with metadata</p>
						<p v-else-if="selected.target.actionType == 'human'" class="is-p is-size-small">You can capture values from the human task data to enrich the process with metadata</p>
						<div v-for="capture in getCapturesFor(selected.target.id)" class="is-column is-color-body is-spacing-medium has-button-close">
							<n-form-text :edit="editable" v-model="capture.name" label="Name" v-if="capture.capture != '$deactivate'"/>
							<n-form-combo :edit="editable" v-model="capture.name" label="Name" v-else :filter="getCapturedValueNames"/>
							<n-form-text :edit="editable" v-if="capture.capture != '$deactivate'" v-model="capture.capture" label="Capture" after="The query to run to capture the value" :timeout="300" @input="updatePhase(capture, value)"/>
							<n-form-combo :edit="editable" v-if="selected.target.actionType == 'service' && capture.capture && !getCapturePhase(capture.capture)" v-model="capture.phase" label="Phase" after="The phase in which it should be captured" :items="['input', 'output']" placeholder="output"/>
							<n-form-switch :edit="editable" v-if="!capture.transient && capture.capture != '$deactivate'" v-model="capture.identifier" label="Identifier" after="Whether or not this field can be counted as an identifying field for this process instance" />
							<n-form-switch :edit="editable" v-if="!capture.identifier && capture.capture != '$deactivate'" v-model="capture.transient" label="Transient" after="Transient captures are not stored but can be used to enrich things like description"/>
							<p class="is-p is-variant-subscript" v-if="capture.capture == '$deactivate'">Deactivate this value when the action is done, preventing further use in mapping or identifying the process instance.</p>
							<button v-if="editable" @click="removeCapture(capture)" class="is-button is-variant-close is-size-small"><icon name="times"/></button>
						</div>
						<n-form-text :edit="editable" v-model="selected.target.description" v-if="getCapturesFor(selected.target.id).length > 0" label="Dynamic description" after="You can use variables to create a variable description for this action instance"/>
					</div>
					<div class="is-row is-align-end is-spacing-gap-xsmall" v-if="editable">
						<button class="is-button is-size-xsmall is-variant-warning-outline" type="button" @click="newCapture(selected.target.id, '$deactivate')"><icon name="times"/><span class="is-text">Deactivate</span></button>
						<button class="is-button is-size-xsmall is-variant-primary-outline" type="button" @click="newCapture(selected.target.id)"><icon name="plus"/><span class="is-text">Capture</span></button>
					</div>
					<n-form-text :edit="editable" type="area" v-model="selected.target.comment" label="Comment" after="Additional comments you want to add"/>
				</div>
				<div v-else-if="selected.type == 'actionRelation'" class="is-column is-spacing-gap-medium">
					<n-form-combo :edit="editable" v-model="selected.target.relationType" label="Relation type" :items="[{name:'flow', title: 'Flow'}, {name: 'flow-start', title: 'Start flow'}, {name: 'flow-stop', title: 'Stop flow'}, {name: 'flow-failed', title: 'Failure flow'}]" @input="draw" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.title }"/>
					<n-form-text :edit="editable" v-model="selected.target.code" label="Code" after="Use this to query the action relation programmatically. Change with caution as you might break references."/>
					<p class="is-p is-variant-subscript" v-if="selected.target.relationType == 'flow'">A flow line limits the lifecycle of the source and the target. The source service can only be invoked until at least one flow line is resolved. A target service can only be invoked once at least one flow line is resolved.</p>
					<p class="is-p is-variant-subscript" v-else-if="selected.target.relationType == 'flow-start'">A start flow line limits the lifecycle of the target without limiting the source. The source service can be invoked regardless of whether this line is resolved. The target service can only be invoked once this line (or a sibling) is resolved.</p>
					<p class="is-p is-variant-subscript" v-else-if="selected.target.relationType == 'flow-stop'">A stop flow line limits the lifecycle of the source without limiting the target. The target service can be invoked regardless of whether this line is resolved. The source service no longer be invoked once this line is resolved.</p>
					<n-form-text :edit="editable" v-model="selected.target.condition" label="Condition" after="You can have this relation only count if a certain condition results to true" @input="draw" :timeout="600"/>
					<n-form-switch :edit="editable" v-model="selected.target.styling.showCondition" label="Always show condition" after="By default the condition is only shown on hover. Toggle this to always show it." v-if="selected.target.condition" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'stateRelation'" class="is-column is-spacing-gap-medium">
					<n-form-combo v-if="selected.target.relationType != 'flow-initial'" :edit="editable" v-model="selected.target.relationType" label="Relation type" :items="[{name:'flow', title: 'Flow'}, {name: 'flow-failed', title: 'Failure flow'}]" @input="draw" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.title }"/>
					<n-form-text :edit="editable" v-model="selected.target.condition" label="Condition" after="You can have this relation only count if a certain condition results to true" @input="draw" :timeout="600"/>
					<n-form-switch :edit="editable" v-model="selected.target.styling.showCondition" label="Always show condition" after="By default the condition is only shown on hover. Toggle this to always show it." v-if="selected.target.condition" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'state'" class="is-column is-spacing-gap-medium">
					<n-form-text :edit="editable" v-model="selected.target.name" label="State name" @input="draw" after="A short name for this state"/>
					<n-form-text :edit="editable" v-model="selected.target.code" label="Code" after="Use this to query the state programmatically. Change with caution as you might break references."/>
					<n-form-combo :edit="editable" v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-switch :edit="editable" v-if="selected.target.initial" v-model="selected.target.initial" label="Initial state" after="A new process instance can only be created in an initial state. There must be at least one in a process."/>
					<n-form-switch :edit="editable" label="Force" v-model="selected.target.force" after="If set, you can make sure all actions (without a force condition) are forced to run"/>
					<n-form-combo :edit="editable" label="Force strategy" v-model="selected.target.forceStrategy" after="Set the default force strategy for this state"
						:items="[{name: 'actionOnly', title: 'Run the action without updating the state'}, {name: 'actionAndState', title: 'Always start a new state instance'}]"
						:formatter="function(x) { return x.title }"
						:extracter="function(x) { return x.name }"/>
					<n-form-text :edit="editable" type="area" v-model="selected.target.comment" label="Comment" after="Additional comments you want to add"/>
				</div>
				<div v-else class="is-column is-spacing-gap-medium">
					<n-form-text :edit="editable" v-model="model.name" label="Process name"/>
					<n-form-text :edit="editable" v-model="model.code" label="Code" after="Use this to query the process programmatically. Change with caution as you might break references."/>
					<n-form-text :edit="editable" v-model="model.queue" label="Process queue" after="By default each process instance has its own anonymous queue, you can however set a shared queue" :placeholder="model.code ? model.code : (model.name ? model.name.replace(/[^\w]+/g, '-').toLowerCase() : 'process')"/>
					<n-form-combo :edit="editable" v-model="model.defaultMigrationStrategy" label="Default migration strategy" :items="['stateOnly', 'stateAndActions']" placeholder="stateAndActions"/>
					<n-form-combo :edit="editable" v-model="model.styling.theme" label="Theme" :items="themes" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text :edit="editable" type="area" v-model="model.comment" label="Comment" after="Additional comments you want to add"/>
					<div class="is-column is-spacing-gap-medium">
						<n-form-combo :edit="editable" v-model="model.defaultIdentificationType" placeholder="correlationId" :items="['global', 'correlationId', 'userId', 'sessionId', 'deviceId', 'custom']" label="Default identification type" after="How do you want to identify process instances by default? This can be overriden per service action."/>
						<p class="is-p is-size-small" v-if="model.defaultIdentificationType == 'correlationId'">A correlation id is limited to a single thread execution, it can be used to follow up on very short processes</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'sessionId'">A session id can be passed in through HTTP requests to link together multiple requests over time. Note that browser-based session ids can be subject to fixation attacks through XSS, they should not be used in critical processes.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'userId'">The user id can be useful though it is a very static identifier.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'deviceId'">Device id can only be used when dealing with browser-based processes.</p>
						<p class="is-p is-size-small" v-else-if="model.defaultIdentificationType == 'custom'">Custom identifiers allow you to extract dynamic values to match, this requires more configuration though as each action must be related back to a custom identifier.</p>
						<p class="is-p is-size-small" v-else>When set to globally, only one instance of a process can be active at a time</p>
					</div>
					<n-form-switch :edit="editable" label="Force" v-model="model.force" after="If set, you can make sure all actions (without a force condition) are forced to run"/>
					<n-form-combo :edit="editable" label="Force strategy" v-model="model.forceStrategy" after="Set the default force strategy for this process"
						:items="[{name: 'actionOnly', title: 'Run the action without updating the state'}, {name: 'actionAndState', title: 'Always start a new state instance'}]"
						:formatter="function(x) { return x.title }"
						:extracter="function(x) { return x.name }"/>
					<n-form-text :edit="editable" v-model="model.anonymizationServiceId" label="Anonymization service" v-if="!hasServiceLister"/>
					<n-form-combo :edit="editable" v-model="model.anonymizationServiceId" label="Anonymization service" v-else :filter="listAnonymizationServices" empty-value="No anonymization services available"
						:formatter="function(x) { return x.label }"
						:extracter="function(x) { return x.value }"/>
					<n-form-text :edit="editable" v-model="model.anonymizationTimeout" label="Anonymization timeout" after="How long after the process ends should it be anonymized?"/>
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
						<symbol id="icon-human" viewBox="0 0 128 128">
							<g style="stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
								<path d="M22.766,0.001C10.194,0.001,0,10.193,0,22.766s10.193,22.765,22.766,22.765c12.574,0,22.766-10.192,22.766-22.765
									S35.34,0.001,22.766,0.001z M22.766,6.808c4.16,0,7.531,3.372,7.531,7.53c0,4.159-3.371,7.53-7.531,7.53
									c-4.158,0-7.529-3.371-7.529-7.53C15.237,10.18,18.608,6.808,22.766,6.808z M22.761,39.579c-4.149,0-7.949-1.511-10.88-4.012
									c-0.714-0.609-1.126-1.502-1.126-2.439c0-4.217,3.413-7.592,7.631-7.592h8.762c4.219,0,7.619,3.375,7.619,7.592
									c0,0.938-0.41,1.829-1.125,2.438C30.712,38.068,26.911,39.579,22.761,39.579z"/>
							</g>
						</symbol>
						<symbol id="icon-synchronous" viewBox="0 0 128 128">
							<g style="stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill-rule: nonzero; opacity: 1;"  >
								<path d="M85.275,18.308c9.75,1.166,18.492,5.614,25.09,12.21c7.732,7.732,12.514,18.415,12.514,30.212 c0,11.799-4.781,22.482-12.514,30.215s-18.416,12.516-30.215,12.516s-22.48-4.783-30.213-12.516S37.422,72.529,37.422,60.73 c0-11.798,4.783-22.48,12.515-30.212c7.083-7.083,16.643-11.691,27.266-12.415v-7.167c0-0.109,0.006-0.216,0.014-0.323h-8.004 c-1.313,0-2.385-1.074-2.385-2.386V2.386C66.828,1.074,67.9,0,69.213,0h24.053c1.313,0,2.387,1.074,2.387,2.386v5.841 c0,1.313-1.074,2.386-2.387,2.386h-8.004c0.01,0.106,0.014,0.214,0.014,0.323V18.308L85.275,18.308z M83.582,54.348 c2.271,1.223,3.814,3.623,3.814,6.383c0,4.002-3.244,7.248-7.246,7.248s-7.246-3.246-7.246-7.248c0-2.76,1.545-5.16,3.816-6.383 V37.744c0-1.895,1.535-3.431,3.43-3.431s3.432,1.536,3.432,3.431V54.348L83.582,54.348z M10.527,84.598 c-1.895,0-3.431-1.537-3.431-3.432s1.536-3.43,3.431-3.43h19.378c1.895,0,3.43,1.535,3.43,3.43s-1.536,3.432-3.43,3.432H10.527 L10.527,84.598z M3.43,64.424c-1.895,0-3.43-1.535-3.43-3.43s1.536-3.432,3.43-3.432h22.447c1.894,0,3.43,1.537,3.43,3.432 s-1.536,3.43-3.43,3.43H3.43L3.43,64.424z M10.354,44.774c-1.895,0-3.43-1.536-3.43-3.43s1.536-3.431,3.43-3.431h19.229 c1.895,0,3.431,1.536,3.431,3.431s-1.536,3.43-3.431,3.43H10.354L10.354,44.774z M118.527,31.215 c1.658-3.958,1.461-8.104-0.912-10.882c-2.848-3.333-7.996-3.715-12.777-1.37C109.902,22.436,114.5,26.476,118.527,31.215 L118.527,31.215z M41.775,31.215c-1.659-3.958-1.462-8.104,0.911-10.882c2.848-3.333,7.996-3.715,12.777-1.37 C50.4,22.436,45.801,26.476,41.775,31.215L41.775,31.215z M105.514,35.369c-6.49-6.491-15.457-10.505-25.363-10.505 c-9.904,0-18.872,4.015-25.362,10.505c-6.491,6.49-10.505,15.458-10.505,25.362c0,9.906,4.015,18.873,10.505,25.363 S70.246,96.6,80.15,96.6c9.906,0,18.873-4.016,25.363-10.506S116.02,70.637,116.02,60.73 C116.02,50.826,112.004,41.859,105.514,35.369L105.514,35.369z"/>
							</g>
						</symbol>
					</defs>
				</svg>
			</div>
			<div class="is-column is-width-max-xsmall is-width-min-xsmall process-modeler-spacer"></div>
		</template>
	</div>
</template>