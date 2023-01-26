<template id="process-modeler-component">
	<div class="process-modeler-component">
		<ul class="is-menu is-variant-toolbar">
			<li class="is-column"><button @click="addState" class="is-button is-variant-primary"><icon name="plus"/><span class="is-text">State</span></button></li>
			<li class="is-column"><button @click="addTemporary" class="is-button is-variant-primary"><icon name="plus"/><span class="is-text">Action</span></button></li>
		</ul>
		<svg ref="svg"/>
	</div>
</template>