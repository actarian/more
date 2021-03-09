import { CoreModule, Module } from 'rxcomp';
import AppComponent from './app.component';
import FlagPipe from './flag/flag.pipe';
import ModelMoreComponent from './world/model-more.component';
import ModelComponent from './world/model.component';
import WorldComponent from './world/world.component';

export class AppModule extends Module { }

AppModule.meta = {
	imports: [
		CoreModule,
	],
	declarations: [
		FlagPipe,
		ModelComponent,
		ModelMoreComponent,
		WorldComponent
	],
	bootstrap: AppComponent,
};
