function toRadians(angle){
	return angle * Math.PI / 360;
}

/* Register Mouse Wheel */
if (window.addEventListener)
	window.addEventListener('DOMMouseScroll', wheel, false);
window.onmousewheel = document.onmousewheel = wheel;

/* wheel function */
function wheel(event){
	var delta = 0;
	if (!event) event = window.event;
	if (event.wheelDelta) {
		delta = event.wheelDelta/120;
		if (window.opera) delta = -delta;
	} else if (event.detail) {
		delta = -event.detail/3;
	}
	if (delta){
		if (delta < 0)
			window.scaleFactor -= 0.1;
		else
			window.scaleFactor += 0.1;
	}
}

function onMouseDown(e){
	this.down = true;
	this.sx = e.pageX;
	this.sy = e.pageY;
}

function onMouseMove(e){
	if(this.down){
		var dx = e.pageX-this.sx;
		var dy = e.pageY-this.sy;
		/*window.pengine.move(1 * dx/canvas.width,1 * dy/canvas.height,0);*/
		window.panX = dx;
		window.panY = dy;
		window.pengine.refresh();
	}
}

function onMouseUp(){
	this.down = false;
}

function PEngine(canvas){
	if (canvas.getContext){
		this.ctx = canvas.getContext("2d");
		//hardcoded parameters
		//frustum parameters
		this.l = -10;
		this.r = 10;
		this.b = -10;
		this.t = 10;
		this.n = -10;
		this.f = -20;
		this.nx = canvas.width;
		this.ny = canvas.height;

		canvas.onmouseup = onMouseUp;
		canvas.onmousedown = onMouseDown;
		canvas.onmousemove = onMouseMove;
		//global variables
		window.pengine = this;
		window.panX = 0;
		window.panY = 0;
		window.scaleFactor = 1;
		this.init();
		this.refresh();
	}else{
		alert("canvas is not supported");
	}
}

PEngine.prototype.init = function(){
		//camera parameter
		this.pov= new Point(3,3,3);
		this.gv = new Point(0,0,0).subtract(this.pov);
		this.tv = new Point(0,0,1);
		//init cam coordinates
		this.w = this.gv.divideScaler(this.gv.modulus()).multiplyScaler(-1);
		this.u = this.tv.cross(this.w).divideScaler(this.tv.cross(this.w).modulus());
		this.v = this.w.cross(this.u);

		with (this){
		//create mo
			var mCanonical = $M([
					[nx/2,0,0,(nx-1)/2],
					[0,-ny/2,0,(ny-1)/2],
					[0,0,1,0],
					[0,0,0,1]]
					);
			var mProjScale= $M([
					[2/(r-l),0,0,0],
					[0,2/(t-b),0,0],
					[0,0,2/(n-f),0],
					[0,0,0,1]]
					);
			var mProjTrans= $M([
					[1,0,0,-(l+r)/2],
					[0,1,0,-(b+t)/2],
					[0,0,1,-(n+f)/2],
					[0,0,0,1]]
					);
			var mo = (mCanonical.x(mProjScale)).x(mProjTrans);

			//create mv
			var mCamRotate = $M([
					[u.x,u.y,u.z,0],
					[v.x,v.y,v.z,0],
					[w.x,w.y,w.z,0],
					[0,0,0,1]
					]);

			var mCamTrans= $M([
					[1,0,0,-pov.x],
					[0,1,0,-pov.y],
					[0,0,1,-pov.z],
					[0,0,0,1]
					]);
			var mv = mCamRotate.x(mCamTrans);
			this.m = mo.x(mv);
		}
}

PEngine.prototype.draw = function(shape){
	shape.draw(this.ctx,this.m);
}

PEngine.prototype.refresh = function(){
	//clear canvas
	this.ctx.clearRect(0,0,canvas.width,canvas.height);
	this.drawGrid();
	this.drawAxes();
}

PEngine.prototype.rotate = function(xang,yang,zang){
	var zrot = $M([
			[Math.cos(zang),-Math.sin(zang),0,0],
			[Math.sin(zang),Math.cos(zang),0,0],
			[0,0,1,0],
			[0,0,0,1]
			]);
	var xrot = $M([
			[1,0,0,0],
			[0,Math.cos(xang),-Math.sin(xang),0],
			[0,Math.sin(xang),Math.cos(xang),0],
			[0,0,0,1],
			]);
	//TODO: rotation around y axis
	this.m = this.m.x(zrot).x(xrot);
}

PEngine.prototype.move = function(dx,dy,dz){
	var mdelta = $M([
			[1,0,0,dx],
			[0,1,0,dy],
			[0,0,1,dz],
			[0,0,0,1],
			]);
	this.m = this.m.x(mdelta);
}

PEngine.prototype.drawAxes = function(){
	var org = new Point(0,0,0);
	var xaxis = new Line(org,new Point(10,0,0));
	var yaxis = new Line(org,new Point(0,10,0));
	var zaxis = new Line(org,new Point(0,0,10));
	xaxis.thickness = 1;
	xaxis.color = "red";
	yaxis.thickness = 1;
	yaxis.color = "green";
	zaxis.thickness = 1;
	zaxis.color = "blue";
	this.draw(xaxis);
	this.draw(yaxis);
	this.draw(zaxis);
}

PEngine.prototype.drawGrid = function(){
	var hlen = 5;
	for (var i=-5;i<=5;i++){
		var l = new Line(new Point(i,-hlen,0),new Point(i,hlen,0));
		var l2 = new Line(new Point(hlen,i,0),new Point(-hlen,i,0));
		l.color = "rgb(200,200,200)";
		l2.color = "rgb(200,200,200)";
		this.draw(l);
		this.draw(l2);
	}
}
//-----------------------------------------------------
//Triangle Object
function Triangle (p1,p2,p3){
	this.p1 = p1;
	this.p2 = p2;
	this.p3 = p3;
	this.color = "black";
}

Triangle.prototype.inspect = function(){
	return "p1 : " + this.p1.inspect() + "\np2: " + this.p1.inspect() + "\np3: " + this.p3.inspect();
}

Triangle.prototype.draw = function(ctx,matrix){
	ctx.fillStyle = this.color;
	ctx.beginPath();
	var pp1 = this.p1.projection(matrix);
	var pp2 = this.p2.projection(matrix);
	var pp3 = this.p3.projection(matrix);
	ctx.moveTo(pp1.x,pp1.y);
	ctx.lineTo(pp2.x,pp2.y);
	ctx.lineTo(pp3.x,pp3.y);
	ctx.lineTo(pp1.x,pp1.y);
	ctx.fill();
}
//-----------------------------------------------------
//Line Object
function Line (start,end){
	this.start = start;
	this.end = end;
	this.color = "black";
	this.thickness = 1;
}

Line.prototype.inspect = function(){
	return "start : " + this.start.inspect() + "\nend : " + this.end.inspect();
}

Line.prototype.draw = function(ctx,matrix){
	ctx.strokeStyle = this.color;
	ctx.lineWidth = this.thickness;
	ctx.beginPath();
	var sp = this.start.projection(matrix);
	var ep = this.end.projection(matrix);
	ctx.moveTo(sp.x,sp.y);
	ctx.lineTo(ep.x,ep.y);
	ctx.stroke();
}

//-----------------------------------------------------
//Point Object
function Point(x,y,z){
	this.x = x;
	this.y = y;
	this.z = z;
	this.thickness = 1;
	this.color = "black";
}

Point.prototype.modulus = function(){
	return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
}

Point.prototype.dot = function(point){
	return this.x*point.x + this.y*point.y + this.z*point.z;
}

Point.prototype.cross = function(point){
	return new Point(this.y*point.z - this.z*point.y,this.z*point.x - this.x*point.z,this.x*point.y - this.y*point.x);
}
Point.prototype.divideScaler = function(mag){
	if (mag == 0) return null;
	return new Point(this.x/mag,this.y/mag,this.z/mag);
}

Point.prototype.multiplyScaler= function(mag){
	return new Point(this.x*mag,this.y*mag,this.z*mag);
}

Point.prototype.subtract = function(point){
	return new Point(this.x-point.x,this.y-point.y,this.z-point.z);
}

Point.prototype.inspect = function(){
	return "( " + this.x + " , " + this.y + " , " + this.z + " )";
}

Point.prototype.draw = function(ctx,matrix){
		var p = this.projection(matrix);
		ctx.fillStyle = this.color;
		ctx.fillRect(p.x,p.y,this.thickness,this.thickness);
}

Point.prototype.projection = function(matrix){
	var point = $M([[this.x *window.scaleFactor],[this.y * window.scaleFactor],[this.z * window.scaleFactor],[1]]);
	var projection = matrix.x(point);
	return new Point(projection.e(1,1) + window.panX,projection.e(2,1) + window.panY,0);
}


//-----------------------------------------------------
// Testing code
function demo(){
	window.pengine.rotate(0,0,toRadians(15));
	window.pengine.refresh();
	/*var lines=[0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,0,0,4,0,1,0,0,1,4,0,0,4,1,0,4,0,1,4,1,1,4,1,0,0,1,0,1,1,1,0,1,1,1,1,0,1,1.5,0,1,1,1,1,1.5,1,1,1.5,0,1,*/
	/*2,0,0,1.5,1,1,2,1,0,2,0,0,3,0,0,2,1,0,3,1,0,1,0,4,1,0,3,1,1,4,1,1,3,1,0,3,1.5,0,3,1,1,3,1.5,1,3,1.5,0,3,2,0,4,1.5,1,3,2,1,4,2,0,4,3,*/
	/*0,4,2,1,4,3,1,4,3,0,4,2,0,2,3,1,4,2,1,2,2,0,2,3,0,0,2,1,2,3,1,0,0,0,4,0,1,4,1,0,4,1,1,4,2,0,4,2,1,4,3,0,4,3,1,4,1,0,3,1,1,3,1.5,0,3,1.5,1,3,*/
	/*0,0,0,0,1,0,1,0,0,1,1,0,1,0,1,1,1,1,1.5,0,1,1.5,1,1,2,0,0,2,1,0,3,0,0,3,1,0,2,0,2,2,1,2];*/
	/*k(new Point(-5,1,0),lines);*/
	/*lines = [0,0,0,0,0,4,0,0,0,3,0,0,0,0,4,3,0,4,3,0,4,3,0,0,1,0,1,1,0,3,1,0,1,2,0,1,1,0,3,2,0,3,2,0,3,2,0,1,*/
	/*0,1,0,0,1,4,0,1,0,3,1,0,0,1,4,3,1,4,3,1,4,3,1,0,1,1,1,1,1,3,1,1,1,2,1,1,1,1,3,2,1,3,2,1,3,2,1,1,*/
	/*0,0,0,0,1,0,3,0,0,3,1,0,0,0,4,0,1,4,3,0,4,3,1,4,1,0,1,1,1,1,2,0,1,2,1,1,1,0,3,1,1,3,2,0,3,2,1,3*/
	/*];*/
	/*k(new Point(-1,1,0),lines);*/
	/*lines = [1,0,0,2,0,0,1,0,0,1,0,3,2,0,0,2,0,3,1,0,3,0,0,3,0,0,3,0,0,4,0,0,4,3,0,4,3,0,4,3,0,3,3,0,3,2,0,3,*/
	/*1,1,0,2,1,0,1,1,0,1,1,3,2,1,0,2,1,3,1,1,3,0,1,3,0,1,3,0,1,4,0,1,4,3,1,4,3,1,4,3,1,3,3,1,3,2,1,3,*/
	/*1,0,0,1,1,0,2,0,0,2,1,0,0,0,3,0,1,3,0,0,4,0,1,4,1,0,3,1,1,3,2,0,3,2,1,3,3,0,3,3,1,3,3,0,4,3,1,4*/
	/*];*/
	/*k(new Point(3,1,0),lines);*/
	var f1a = new Triangle(new Point(0,0,0),new Point(1,0,1),new Point(0,0,1));
	f1a.color = "red";
	window.pengine.draw(f1a);
	var f1b = new Triangle(new Point(0,0,0),new Point(1,0,0),new Point(1,0,1));
	f1b.color = "red";
	window.pengine.draw(f1b);

	var f2a = new Triangle(new Point(0,1,0),new Point(1,1,1),new Point(0,1,1));
	f2a.color = "blue";
	window.pengine.draw(f2a);
	var f2b = new Triangle(new Point(0,1,0),new Point(1,1,0),new Point(1,1,1));
	f2b.color = "blue";
	window.pengine.draw(f2b);
}

function k(base,lines){
	for (var i=0;i<lines.length;i+=6){
		var l = new Line(new Point(base.x + lines[i],base.y + lines[i+1],base.z + lines[i+2]) ,
				new Point(base.x + lines[i+3] , base.y + lines[i+4] , base.z + lines[i+5]));
		window.pengine.draw(l);
	}
}
