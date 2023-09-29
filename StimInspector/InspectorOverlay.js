/**
 * PsychoJS Overlay for StimInspector.
 *
 * @author Nikita Agafonov https://github.com/lightest
 * @copyright (c) 2020-2023 Open Science Tools Ltd. (https://opensciencetools.org)
 * @license Distributed under the terms of the MIT License
 * @description Provides overlay mode for StimInspector, which highlights stimuli on the screen and shows useful data.
 */

const MIN_SCALE = .001;

export class InspectorOverlay
{
	constructor(pjsWin, pjsLib)
	{
		if (!pjsWin) {
			throw "Need PsychoJS win to work!";
		}
		if (!pjsLib) {
			throw "Need PsychoJS to work!";
		}

		this._active = false;
		this._pjsLib = pjsLib;
		this._pjsWin = pjsWin;
		this._intersectedSceneElement = undefined;
		this._intersectedStim = undefined;
		this._dragging = false;

		this._pointer = {
			x: 0,
			y: 0
		};


		// Storing binded handlers, so that it's possible to remove them from event listening explicitly.
		this._handlers = {
			onWheel: this._onWheel.bind(this),
			onPointermove: this._onPointermove.bind(this),
			onPointerdown: this._onPointerdown.bind(this),
			onPointerup: this._onPointerup.bind(this)
		}

		this._debug = true;
		this._debugPointer = undefined;
	}

	toggleActive()
	{
		if (this._active)
		{
			this.deactivate();
		}
		else
		{
			this.activate();
		}
	}

	activate()
	{
		document.body.insertAdjacentHTML("beforeend", this._constructHTML());
		this._addEventListeners();
		this._active = true;
	}

	deactivate()
	{
		this._removeEventListeners();
		document.body.removeChild(document.querySelector(".stim-overlay-container"));
		this._active = false;
	}

	showGrid()
	{

	}

	addPanAndZoom()
	{

	}

	_constructHTML()
	{
		const html =
		`<div class="stim-overlay-container">
			<div class="overlay-element"></div>
		</div>`;

		return html;
	}

	_findElementIntersectedByPointer()
	{
		const sceneElements = this._pjsWin._stimsContainer.children;
		let intersectedSceneElement;
		let intersectedStim;
		const cursorPoint = {x: e.clientX, y: e.clientY};
		let tmpPoint = {x: 0, y: 0};

		// Early exit if still inside previously intersected stim.
		if (this._intersectedStim)
		{
			this._intersectedSceneElement.worldTransform.applyInverse(cursorPoint, tmpPoint);
		}

		let i;
		for (i = sceneElements.length - 1; i >= 0; i--)
		{
			if (typeof sceneElements[i].containsPoint === "function" && sceneElements[i].containsPoint(cursorPoint))
			{
				intersectedSceneElement = sceneElements[i];
				break;
			}
			else
			{
				sceneElements[i].worldTransform.applyInverse(cursorPoint, tmpPoint);
				if (sceneElements[i].getLocalBounds().contains(tmpPoint.x, tmpPoint.y))
				{
					intersectedSceneElement = sceneElements[i];
					break;
				}
			}
		}

		for (i = 0; i < this._pjsWin._drawList.length; i++) {
			if (this._pjsWin._drawList[i]._pixi === intersectedSceneElement) {
				intersectedStim = this._pjsWin._drawList[i];
				break;
			}
		}

		if (intersectedStim) {
			this._intersectedStim = intersectedStim;
			this._intersectedSceneElement = intersectedSceneElement;
			this.displayStimData(clickedStim);
		}
	}

	_handlePanning(x, y)
	{
		if (!this._dragging)
		{
			return;
		}

		const stimsContainer = this._pjsWin._stimsContainer;
		const dx = x - this._pointer.x;
		const dy = y - this._pointer.y;
		stimsContainer.position.x += dx;
		stimsContainer.position.y -= dy;
	}

	_handleZoom(pointerX, pointerY, delta)
	{
		const stimsContainer = this._pjsWin._stimsContainer;

		// stimsContainer.pivot.set(x, y);
		// this._pjsWin._stimsContainer.pivot.set(x, y);
		// this._pjsWin._stimsContainer.position.set(x,y);

		// Assuming both x and y scales are the same. Scale, represented by ObservablePoint (PIXI class) doesn't have common get() method.

		const oldPos = this._clientToPixiContainerCoords(
			pointerX,
			pointerY,
			stimsContainer.position.x,
			stimsContainer.position.y,
			stimsContainer.scale.x,
			stimsContainer.scale.y
		);

		const oldScale = {x: stimsContainer.scale.x, y: stimsContainer.scale.y};
		const x = pointerX - window.innerWidth * .5;
		const y = window.innerHeight - pointerY - window.innerHeight * .5;

		// console.log(x, y);
		// console.log(oldPos);
		const initialPos = stimsContainer.position;
		// const k = Math.sign(delta);
		const k = 1;
		const newScale = Math.max(MIN_SCALE, stimsContainer.scale.x - delta * .00025);
		stimsContainer.scale.set(newScale);
		// stimsContainer.position.set(initialPos.x + x * k, initialPos.y + y * k);

		const newPos = this._clientToPixiContainerCoords(
			pointerX,
			pointerY,
			stimsContainer.position.x,
			stimsContainer.position.y,
			stimsContainer.scale.x,
			stimsContainer.scale.y
		);

		const dx = newPos.x - oldPos.x;
		const dy = newPos.y - oldPos.y;
		const scaleDx = newScale - oldScale.x;
		console.log(dx, dy, dy * newScale);

		stimsContainer.position.set(stimsContainer.position.x + dx * newScale, stimsContainer.position.y + dy * newScale);

		const newPos2 = this._clientToPixiContainerCoords(
			pointerX,
			pointerY,
			stimsContainer.position.x,
			stimsContainer.position.y,
			stimsContainer.scale.x,
			stimsContainer.scale.y
		);
		// this._debugPointer.setPos([newPos2.x, newPos2.y]);
	}

	_onWheel(e)
	{
		this._handleZoom(e.clientX, e.clientY, e.deltaY);
	}

	_onPointermove(e)
	{
		this._handlePanning(e.clientX, e.clientY);
		this._pointer.x = e.clientX;
		this._pointer.y = e.clientY;
	}

	_clientToWorldCoords (clientX, clientY)
	{
		const x = clientX - window.innerWidth * .5;
		const y = window.innerHeight - clientY - window.innerHeight * .5;

		return {x, y};
	}

	_clientToPixiContainerCoords (clientX, clientY, containerPosX, containerPosY, scaleX, scaleY)
	{
		const x = clientX - window.innerWidth * .5;
		const y = window.innerHeight - clientY - window.innerHeight * .5;

		return {
			x: (x - containerPosX) / scaleX,
			y: (y - containerPosY) / scaleY
		};
	}

	_onPointerdown(e)
	{
		this._dragging = true;

		if (this._debug && this._debugPointer === undefined && this._pjsWin._psychoJS._experiment)
		{
			this._debugPointer = new this._pjsLib.visual.Rect({
				name: "R",
				win: this._pjsWin,
				fillColor: "red",
				units: "pix",
				width: 50,
				height: 50,
				depth: -200
			});

			this._debugPointer.setAutoDraw(true);
		}

		const scale = this._pjsWin._stimsContainer.scale;
		console.log(scale);
		const stimsContainer = this._pjsWin._stimsContainer;
		// const x = e.clientX - window.innerWidth * .5;
		// const y = window.innerHeight - e.clientY - window.innerHeight * .5;

		// this._pjsWin._stimsContainer.pivot.set(x, y);
		// this._pjsWin._stimsContainer.position.set(x,y);

		const {x,y} = this._clientToPixiContainerCoords(e.clientX, e.clientY, stimsContainer.x, stimsContainer.y, scale.x, scale.y);

		this._debugPointer.setPos([x,y]);
	}

	_onPointerup(e)
	{
		this._dragging = false;
	}

	_addEventListeners()
	{
		window.addEventListener("wheel", this._handlers.onWheel);
		window.addEventListener("pointermove", this._handlers.onPointermove);
		window.addEventListener("pointerdown", this._handlers.onPointerdown);
		window.addEventListener("pointerup", this._handlers.onPointerup);
	}

	_removeEventListeners()
	{
		window.removeEventListener("wheel", this._handlers.onWheel);
		window.removeEventListener("pointermove", this._handlers.onPointermove);
		window.removeEventListener("pointerdown", this._handlers.onPointerdown);
		window.removeEventListener("pointerup", this._handlers.onPointerup);
	}
}
